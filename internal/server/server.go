package server

import (
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"log"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hydrui/hydrui/internal/pack"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/acme/autocert"
)

//go:embed index.html.tmpl
var indexHTML string

type TemplateData struct {
	CSP          string
	JSPath       string
	CSSPath      string
	JSIntegrity  string
	CSSIntegrity string
	ServerMode   bool
}

// LoginRequest represents the JSON request for login
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse represents the JSON response for login
type LoginResponse struct {
	Token string `json:"token"`
}

// BridgeRequest represents the JSON request for building bridges
type BridgeRequest struct {
	// Target is the target path to build a bridge to (relative to the Hydrus API root.)
	Target string `json:"target"`
}

func calculateFileHash(fsys fs.FS, path string) (hash string, err error) {
	var f fs.File
	f, err = fsys.Open(path)
	if err != nil {
		return "", err
	}
	defer func() {
		if err2 := f.Close(); err2 != nil {
			err = errors.Join(err, err2)
		}
	}()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}

	return fmt.Sprintf("sha256-%s", base64.StdEncoding.EncodeToString(h.Sum(nil))), nil
}

func findAssetFiles(fsys fs.FS) (jsPath, cssPath string, err error) {
	entries, err := fs.ReadDir(fsys, "assets")
	if err != nil {
		return "", "", err
	}

	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, "index-") && strings.HasSuffix(name, ".js") {
			jsPath = "assets/" + name
		} else if strings.HasPrefix(name, "index-") && strings.HasSuffix(name, ".css") {
			cssPath = "assets/" + name
		}
	}

	if jsPath == "" || cssPath == "" {
		return "", "", fmt.Errorf("could not find required asset files")
	}

	return jsPath, cssPath, nil
}

func generateToken(username string, key []byte) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"username": username,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
	})
	return token.SignedString(key)
}

func validateToken(token string, key []byte) (bool, error) {
	parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
		return key, nil
	})
	if err != nil {
		return false, err
	}
	if _, ok := parsedToken.Claims.(jwt.MapClaims); ok && parsedToken.Valid {
		return true, nil
	}
	return false, nil
}

type Config struct {
	Listen         string
	ListenTLS      string
	Socket         string
	SocketTLS      string
	TLSCertFile    string
	TLSKeyFile     string
	Secret         string
	HydrusURL      string
	HydrusSecure   bool
	HydrusAPIKey   string
	HtpasswdFile   *HtpasswdFile
	Secure         bool
	ServerMode     bool
	AllowBugReport bool
	ACME           *autocert.Manager
}

func New(config Config, clientData *pack.Pack) http.Handler {
	mux := http.NewServeMux()

	jsPath, cssPath, err := findAssetFiles(clientData)
	if err != nil {
		log.Fatal(err)
	}

	jsIntegrity, err := calculateFileHash(clientData, jsPath)
	if err != nil {
		log.Fatal(err)
	}

	cssIntegrity, err := calculateFileHash(clientData, cssPath)
	if err != nil {
		log.Fatal(err)
	}

	tmpl, err := template.New("index").Parse(indexHTML)
	if err != nil {
		log.Fatal(err)
	}

	csp := "default-src 'none';"
	csp += "script-src 'self' 'wasm-unsafe-eval';" // Ruffle needs wasm-unsafe-eval
	csp += "style-src 'self' 'unsafe-inline';"     // Ruffle needs unsafe-inline
	if config.ServerMode {
		csp += "connect-src 'self';"
		csp += "img-src 'self' data: blob:;"
		csp += "media-src 'self' blob:;"
	} else {
		// In pure client mode, the client may need to connect to arbitrary origins.
		csp += "connect-src *;"
		csp += "img-src *;"
		csp += "media-src *;"
	}
	csp += "frame-ancestors 'none';"
	csp += "base-uri 'self';"

	// Template data
	data := TemplateData{
		CSP:          csp,
		JSPath:       "/" + jsPath,
		CSSPath:      "/" + cssPath,
		JSIntegrity:  jsIntegrity,
		CSSIntegrity: cssIntegrity,
		ServerMode:   config.ServerMode,
	}

	if config.ServerMode {
		if config.AllowBugReport {
			// Bug report proxy handler
			wsUpgrader := websocket.Upgrader{
				HandshakeTimeout: 5 * time.Second,
			}
			wsDialer := websocket.Dialer{}
			mux.HandleFunc("/bug-report", func(w http.ResponseWriter, r *http.Request) {
				downstream, err := wsUpgrader.Upgrade(w, r, nil)
				if err != nil {
					slog.LogAttrs(r.Context(), slog.LevelDebug, "WebSocket Upgrade failed.", slog.Any("error", err))
					return
				}
				defer func() {
					if err := downstream.Close(); err != nil {
						slog.LogAttrs(r.Context(), slog.LevelDebug, "Error closing downstream WebSocket connection.", slog.Any("error", err))
						return
					}
				}()
				upstream, upstreamResp, err := wsDialer.DialContext(r.Context(), "https://hydrui.dev/bug-report", http.Header{})
				if err == websocket.ErrBadHandshake && upstreamResp != nil {
					defer func() {
						if err := upstreamResp.Body.Close(); err != nil {
							slog.LogAttrs(r.Context(), slog.LevelDebug, "Error closing upstream HTTP response.", slog.Any("error", err))
							return
						}
					}()
					w.WriteHeader(upstreamResp.StatusCode)
					if _, err := io.Copy(w, upstreamResp.Body); err != nil {
						slog.LogAttrs(r.Context(), slog.LevelDebug, "Error forwarding HTTP response.", slog.Any("error", err))
					}
					return
				} else if err != nil {
					slog.LogAttrs(r.Context(), slog.LevelDebug, "Error opening upstream WebSocket connection.", slog.Any("error", err))
					return
				}
				defer func() {
					if err := upstream.Close(); err != nil {
						slog.LogAttrs(r.Context(), slog.LevelDebug, "Error closing upstream WebSocket connection.", slog.Any("error", err))
						return
					}
				}()
				for {
					t, mr, err := downstream.NextReader()
					if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
						err := upstream.WriteControl(websocket.CloseMessage, nil, time.Now().Add(5*time.Second))
						if err != nil {
							slog.LogAttrs(r.Context(), slog.LevelDebug, "Error sending close message to upstream.", slog.Any("error", err))
							return
						}
						break
					} else if err != nil {
						slog.LogAttrs(r.Context(), slog.LevelDebug, "Error reading downstream WebSocket message.", slog.Any("error", err))
						return
					}
					mw, err := upstream.NextWriter(t)
					if err != nil {
						slog.LogAttrs(r.Context(), slog.LevelDebug, "Error writing upstream WebSocket message.", slog.Any("error", err))
						return
					}
					if _, err := io.Copy(mw, mr); err != nil {
						slog.LogAttrs(r.Context(), slog.LevelDebug, "Error forwarding WebSocket message.", slog.Any("error", err))
					}
				}
			})
		}

		proxyClient := &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					InsecureSkipVerify: !config.HydrusSecure,
				},
			},
		}

		proxyRequest := func(w http.ResponseWriter, method, proxyURL string, body io.Reader, header http.Header) {
			proxyReq, err := http.NewRequest(method, proxyURL, body)
			if err != nil {
				http.Error(w, "Error creating proxy request", http.StatusInternalServerError)
				return
			}

			for key, values := range header {
				for _, value := range values {
					proxyReq.Header.Add(key, value)
				}
			}

			proxyReq.Header.Set("Hydrus-Client-API-Access-Key", config.HydrusAPIKey)

			q := proxyReq.URL.Query()
			q.Del("Hydrus-Client-API-Access-Key")
			proxyReq.URL.RawQuery = q.Encode()
			log.Printf("Proxy request: %s %s", proxyReq.Method, proxyReq.URL.String())

			resp, err := proxyClient.Do(proxyReq)
			if err != nil {
				http.Error(w, "Error making proxy request", http.StatusBadGateway)
				return
			}
			defer func() {
				_ = resp.Body.Close()
			}()

			for key, values := range resp.Header {
				for _, value := range values {
					w.Header().Add(key, value)
				}
			}

			w.WriteHeader(resp.StatusCode)
			_, _ = io.Copy(w, resp.Body)
		}

		// Hydrus proxy handler
		mux.HandleFunc("/hydrus/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")

			sessionToken, err := r.Cookie("hydrui-session")
			if err != nil {
				http.Error(w, "Not logged in", http.StatusUnauthorized)
				return
			}

			valid, err := validateToken(sessionToken.Value, []byte(config.Secret))
			if err != nil {
				http.Error(w, "Invalid session token", http.StatusUnauthorized)
				return
			}

			if !valid {
				http.Error(w, "Invalid session token", http.StatusUnauthorized)
				return
			}

			proxyURL := config.HydrusURL + strings.TrimPrefix(r.URL.Path, "/hydrus")
			if r.URL.RawQuery != "" || r.URL.ForceQuery {
				proxyURL += "?" + r.URL.RawQuery
			}
			proxyRequest(w, r.Method, proxyURL, r.Body, r.Header)
		})

		// One-time-proxy handler. Used for hand-off to Photopea.
		bridges := sync.Map{}
		mux.HandleFunc("/bridge/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")

			switch r.Method {
			case http.MethodOptions:
				_, loaded := bridges.Load(r.URL.Path)
				if !loaded {
					http.NotFound(w, r)
					return
				}
				w.Header().Set("Access-Control-Allow-Headers", "*")
				w.Header().Set("Access-Control-Allow-Methods", "GET")
				w.Header().Set("Access-Control-Allow-Origin", "*")
				w.Header().Set("Access-Control-Max-Age", "86400")
				w.Header().Set("Content-Length", "0")
				w.WriteHeader(http.StatusOK)
			case http.MethodGet:
				value, loaded := bridges.LoadAndDelete(r.URL.Path)
				if !loaded {
					http.NotFound(w, r)
					return
				}
				path, ok := value.(string)
				if !ok {
					http.Error(w, "Internal error", http.StatusInternalServerError)
					return
				}
				proxyURL := config.HydrusURL + path
				if r.URL.RawQuery != "" || r.URL.ForceQuery {
					proxyURL += "?" + r.URL.RawQuery
				}
				proxyRequest(w, r.Method, proxyURL, r.Body, r.Header)
			case http.MethodPost:
				sessionToken, err := r.Cookie("hydrui-session")
				if err != nil {
					http.Error(w, "Not logged in", http.StatusUnauthorized)
					return
				}

				valid, err := validateToken(sessionToken.Value, []byte(config.Secret))
				if err != nil {
					http.Error(w, "Invalid session token", http.StatusUnauthorized)
					return
				}

				if !valid {
					http.Error(w, "Invalid session token", http.StatusUnauthorized)
					return
				}

				var bridgeReq BridgeRequest
				if err := json.NewDecoder(r.Body).Decode(&bridgeReq); err != nil {
					http.Error(w, "Invalid request", http.StatusBadRequest)
					return
				}
				bridges.Store(r.URL.Path, bridgeReq.Target)
				w.WriteHeader(http.StatusNoContent)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		})

		// Login handler
		mux.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Content-Security-Policy", csp)

			if r.Method != http.MethodPost {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}

			if config.HtpasswdFile == nil {
				http.Error(w, "Authentication not configured", http.StatusInternalServerError)
				return
			}

			var loginReq LoginRequest
			if err := json.NewDecoder(r.Body).Decode(&loginReq); err != nil {
				http.Error(w, "Invalid request", http.StatusBadRequest)
				return
			}

			authenticated, err := config.HtpasswdFile.Authenticate(loginReq.Username, loginReq.Password)
			if err != nil {
				log.Printf("Authentication error: %v", err)
				http.Error(w, "Authentication error", http.StatusInternalServerError)
				return
			}

			if !authenticated {
				_ = subtle.ConstantTimeCompare([]byte(loginReq.Password), []byte(loginReq.Password))
				http.Error(w, "Invalid credentials", http.StatusUnauthorized)
				return
			}

			token, err := generateToken(loginReq.Username, []byte(config.Secret))
			if err != nil {
				log.Printf("Failed to generate token: %v", err)
				http.Error(w, "Failed to generate token", http.StatusInternalServerError)
				return
			}

			http.SetCookie(w, &http.Cookie{
				Name:     "hydrui-session",
				Value:    token,
				Path:     "/",
				Expires:  time.Now().Add(time.Hour * 24 * 30),
				HttpOnly: true,
				Secure:   config.Secure,
				SameSite: http.SameSiteStrictMode,
			})

			w.WriteHeader(http.StatusOK)
		})

		mux.HandleFunc("/logout", func(w http.ResponseWriter, r *http.Request) {
			http.SetCookie(w, &http.Cookie{
				Name:     "hydrui-session",
				Value:    "",
				Path:     "/",
				Expires:  time.Unix(0, 0),
				MaxAge:   -1,
				HttpOnly: true,
				Secure:   config.Secure,
				SameSite: http.SameSiteStrictMode,
			})
		})
	}

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", csp)

		if r.URL.Path == "/" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			if err := tmpl.Execute(w, data); err != nil {
				log.Printf("Template error: %v", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
			return
		}

		clientData.ServeHTTP(w, r)
	})

	return mux
}

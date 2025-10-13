package options

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/hydrui/hydrui/internal/server"

	"golang.org/x/crypto/acme"
	"golang.org/x/crypto/acme/autocert"
)

type Values struct {
	Listen         string
	ListenTLS      string
	ListenInternal string
	Socket         string
	SocketTLS      string
	SocketInternal string
	TLSCertFile    string
	TLSKeyFile     string
	Secret         string
	HydrusURL      string
	HydrusSecure   bool
	HydrusAPIKey   string
	HtpasswdFile   string
	UseACME        bool
	ACMEEmail      string
	ACMEURL        string
	ACMEDir        string
	ACMEHostRegex  string
	Secure         bool
	ServerMode     bool
	NoAuth         bool
	AllowBugReport bool
	NoGUI          bool
}

func NewDefault() *Values {
	return &Values{
		Listen:  ":8080",
		Secure:  true,
		ACMEURL: acme.LetsEncryptURL,

		AllowBugReport: true,
	}
}

func (v Values) Clone() *Values {
	return &v
}

func (v *Values) ParseFlags(args []string) error {
	// Expand environment variable references in args.
	for i := range args {
		args[i] = expandEnv(args[i])
	}
	set := flag.NewFlagSet(args[0], flag.ContinueOnError)
	set.StringVar(&v.Listen, "listen", v.Listen, "Listen address for HTTP")
	set.StringVar(&v.ListenTLS, "listen-tls", v.ListenTLS, "Listen address for HTTPS (TLS)")
	set.StringVar(&v.ListenInternal, "listen-internal", v.ListenInternal, "Internal listen address (metrics/healthcheck/etc.)")
	set.StringVar(&v.Socket, "socket", v.Socket, "Listen on UNIX domain socket for HTTP")
	set.StringVar(&v.SocketTLS, "socket-tls", v.SocketTLS, "Listen on UNIX domain socket for HTTPS (TLS)")
	set.StringVar(&v.SocketInternal, "socket-internal", v.SocketInternal, "Internal UNIX domain socket (metrics/healthcheck/etc.)")
	set.StringVar(&v.TLSCertFile, "tls-cert-file", v.TLSCertFile, "TLS certificate file to use for TLS port (full chain, PEM-formatted)")
	set.StringVar(&v.TLSKeyFile, "tls-key-file", v.TLSKeyFile, "TLS private key file to use for TLS port (PEM-formatted)")
	SecretVar(set, &v.Secret, "secret", v.Secret, "secret key for JWT token")
	set.StringVar(&v.HydrusURL, "hydrus-url", v.HydrusURL, "Hydrus URL")
	set.BoolVar(&v.HydrusSecure, "hydrus-secure", v.HydrusSecure, "Enable validating the TLS certificate of the Hydrus server")
	SecretVar(set, &v.HydrusAPIKey, "hydrus-api-key", v.HydrusAPIKey, "Hydrus API key")
	set.StringVar(&v.HtpasswdFile, "htpasswd", v.HtpasswdFile, "Path to htpasswd file for authentication")
	set.BoolVar(&v.UseACME, "acme", v.UseACME, "Enable ACME, acquire TLS certificate")
	set.StringVar(&v.ACMEEmail, "acme-email", v.ACMEEmail, "E-mail address to use for ACME account")
	set.StringVar(&v.ACMEURL, "acme-url", v.ACMEURL, "URL to use for ACME endpoint")
	set.StringVar(&v.ACMEDir, "acme-dir", v.ACMEDir, "Directory to store ACME credentials")
	set.StringVar(&v.ACMEHostRegex, "acme-host-match", v.ACMEHostRegex, "RE2-compatible regular expression pattern to match allowed hosts for ACME certs")
	set.BoolVar(&v.Secure, "secure", v.Secure, "Use secure cookies")
	set.BoolVar(&v.ServerMode, "server-mode", v.ServerMode, "Enable or disable server mode; server mode proxies the Hydrus API and provides a login page")
	set.BoolVar(&v.NoAuth, "no-auth", v.NoAuth, "Disables authentication in server mode")
	set.BoolVar(&v.AllowBugReport, "allow-bug-report", v.AllowBugReport, "Allow user to submit bug reports to the Hydrui Mothership")
	set.BoolVar(&v.NoGUI, "nogui", v.NoGUI, "Disable the GUI, if GUI support is available")
	return set.Parse(args[1:])
}

func stringEnv(p *string, name string) {
	if v := os.Getenv(name); v != "" {
		*p = v
	}
}

func boolEnv(p *bool, name string) {
	if v := os.Getenv(name); v != "" {
		v = strings.ToLower(v)
		switch v {
		case "1", "true", "yes":
			*p = true
		case "0", "false", "no":
			*p = false
		default:
			slog.Warn("Ignoring invalid value for boolean env " + name + ": " + v)
		}
	}
}

func (v *Values) ParseEnv() {
	stringEnv(&v.Listen, "HYDRUI_LISTEN")
	stringEnv(&v.ListenTLS, "HYDRUI_LISTEN_TLS")
	stringEnv(&v.ListenInternal, "HYDRUI_LISTEN_INTERNAL")
	stringEnv(&v.Socket, "HYDRUI_SOCKET")
	stringEnv(&v.SocketTLS, "HYDRUI_SOCKET_TLS")
	stringEnv(&v.SocketInternal, "HYDRUI_SOCKET_INTERNAL")
	stringEnv(&v.TLSCertFile, "HYDRUI_TLS_CERT_FILE")
	stringEnv(&v.TLSKeyFile, "HYDRUI_TLS_KEY_FILE")
	stringEnv(&v.Secret, "HYDRUI_SECRET")
	stringEnv(&v.HydrusURL, "HYDRUI_HYDRUS_URL")
	boolEnv(&v.HydrusSecure, "HYDRUI_HYDRUS_SECURE")
	stringEnv(&v.HydrusAPIKey, "HYDRUI_HYDRUS_API_KEY")
	stringEnv(&v.HtpasswdFile, "HYDRUI_HTPASSWD")
	boolEnv(&v.UseACME, "HYDRUI_ACME")
	stringEnv(&v.ACMEEmail, "HYDRUI_ACME_EMAIL")
	stringEnv(&v.ACMEURL, "HYDRUI_ACME_URL")
	stringEnv(&v.ACMEDir, "HYDRUI_ACME_DIR")
	stringEnv(&v.ACMEHostRegex, "HYDRUI_ACME_HOST_MATCH")
	boolEnv(&v.Secure, "HYDRUI_SECURE")
	boolEnv(&v.ServerMode, "HYDRUI_SERVER_MODE")
	boolEnv(&v.NoAuth, "HYDRUI_NO_AUTH")
	boolEnv(&v.AllowBugReport, "HYDRUI_ALLOW_BUG_REPORT")
	boolEnv(&v.NoGUI, "HYDRUI_NOGUI")
}

func (v *Values) ServerConfig(ctx context.Context, log *slog.Logger) (server.Config, error) {
	result := server.Config{
		Listen:         v.Listen,
		ListenTLS:      v.ListenTLS,
		ListenInternal: v.ListenInternal,
		Socket:         v.Socket,
		SocketTLS:      v.SocketTLS,
		TLSCertFile:    v.TLSCertFile,
		TLSKeyFile:     v.TLSKeyFile,
		Secret:         v.Secret,
		HydrusURL:      v.HydrusURL,
		HydrusAPIKey:   v.HydrusAPIKey,
		Secure:         v.Secure,
		ServerMode:     v.ServerMode,
		NoAuth:         v.NoAuth,
		AllowBugReport: v.AllowBugReport,
	}

	if v.ServerMode {
		if v.HydrusURL == "" {
			return server.Config{}, fmt.Errorf("hydrus client URL is required, e.g. http://localhost:45869")
		}

		result.HydrusAPIKey = strings.TrimSpace(result.HydrusAPIKey)

		if v.HydrusAPIKey == "" {
			return server.Config{}, fmt.Errorf("hydrus client API key is required, but not specified")
		}

		if v.Secret == "" {
			secretFile, err := getDefaultSecretFile()
			if err != nil {
				log.Error("No secret file specified and could not determine the default location.", slog.Any("error", err))
			} else {
				secret, err := getOrCreateSecret(secretFile)
				if err != nil {
					log.Warn("Could not create or open the JWT secret file.", slog.Any("error", err), slog.String("file", secretFile))
				} else {
					v.Secret = secret
				}
			}
			if v.Secret == "" {
				log.Warn("Could not use a persistant JWT secret. Sessions will not be persisted.")
				v.Secret, err = generateSecret()
				if err != nil {
					return server.Config{}, fmt.Errorf("failed to generate JWT secret: %w", err)
				}
			}
		}

		if v.HtpasswdFile != "" {
			if v.NoAuth {
				return server.Config{}, fmt.Errorf("only one of -htpasswd and -no-auth may be specified")
			}
			file, err := os.Open(v.HtpasswdFile)
			if err != nil {
				return server.Config{}, fmt.Errorf("failed to open htpasswd file: %w", err)
			}
			defer func() {
				if err := file.Close(); err != nil {
					log.LogAttrs(ctx, slog.LevelWarn, "Failed to close file")
				}
			}()
			htpasswd, err := server.LoadHtpasswdFile(file)
			if err != nil {
				return server.Config{}, fmt.Errorf("failed to load htpasswd file: %w", err)
			}
			log.LogAttrs(ctx, slog.LevelInfo, "Loaded users from htpasswd file", slog.Int("users", len(htpasswd.Users)))
			result.HtpasswdFile = htpasswd
		} else if !v.NoAuth {
			log.LogAttrs(ctx, slog.LevelWarn, "No htpasswd file provided, using default credentials admin:admin.")
			result.HtpasswdFile, _ = server.LoadHtpasswdFile(strings.NewReader("admin:$2y$10$0QGYPQwkzu63CRCpOJDOre3YLvXV8U19XnrHr/wEuFvBzVUwbiR0C"))
		} else {
			result.HtpasswdFile = nil
		}

		if v.AllowBugReport {
			log.LogAttrs(ctx, slog.LevelInfo, "allow bug report is enabled. This allows you to make bug reports in the UI.")
			log.LogAttrs(ctx, slog.LevelInfo, "allow bug report does *not* automatically send information of any kind to anywhere.")
			log.LogAttrs(ctx, slog.LevelInfo, "If you disable it, the bug report UI remains visible, but requests will be blocked.")
			log.LogAttrs(ctx, slog.LevelInfo, "Hint: Disable bug reporting in CLI with -allow-bug-report=false.")
		}
	} else {
		if v.HydrusURL != "" {
			log.LogAttrs(ctx, slog.LevelWarn, "Hydrus client URL is not used in client-only mode.")
		}

		if v.HydrusAPIKey != "" {
			log.LogAttrs(ctx, slog.LevelWarn, "Hydrus client API key is not used in client-only mode.")
		}

		if v.HtpasswdFile != "" {
			log.LogAttrs(ctx, slog.LevelWarn, "Htpasswd file is not used in client-only mode.")
		}

		if !v.NoAuth {
			log.LogAttrs(ctx, slog.LevelWarn, "No auth mode is not used in client-only mode.")
		}

		if v.Secret != "" {
			log.LogAttrs(ctx, slog.LevelWarn, "Secret file is not used in client-only mode.")
		}

		if !v.AllowBugReport {
			return server.Config{}, errors.New("'allow bug report' is disabled, but that has no effect in client-only mode; re-enable it if you are OK with this")
		}

		log.LogAttrs(ctx, slog.LevelInfo, "Note: in client-only mode, the Hydrui Client will access the Internet directly.")
		log.LogAttrs(ctx, slog.LevelInfo, "Server-only mode can improve security by managing all external requests.")
		log.LogAttrs(ctx, slog.LevelInfo, "In client-only mode, the issue report functionality is always accessible.")
		log.LogAttrs(ctx, slog.LevelInfo, "Visit the documentation for more information.")
		log.LogAttrs(ctx, slog.LevelInfo, "https://hydrui.dev/en/docs/server-mode/")
	}

	if v.UseACME {
		if v.ListenTLS == "" && v.SocketTLS == "" {
			return server.Config{}, fmt.Errorf("-use-acme is set, but neither -listen-tls nor -socket-tls are set")
		}

		if v.ACMEEmail == "" {
			log.LogAttrs(ctx, slog.LevelWarn, "-use-acme is set, but -acme-email is not specified.")
		}

		if v.ACMEDir == "" {
			cacheDir, err := os.UserCacheDir()
			if err != nil {
				return server.Config{}, fmt.Errorf("-acme-dir is not specified and could not determine user cache dir: %w", err)
			}
			acmeCacheDir := filepath.Join(cacheDir, "acme")
			if err := os.MkdirAll(acmeCacheDir, 0700); err != nil {
				return server.Config{}, fmt.Errorf("-acme-dir is not specified and could not create default cache dir %q: %w", acmeCacheDir, err)
			}
			v.ACMEDir = acmeCacheDir
			log.LogAttrs(ctx, slog.LevelInfo, "Storing ACME credentials in user cache dir.", slog.String("path", v.ACMEDir))
		}

		var hostPolicy autocert.HostPolicy
		if v.ACMEHostRegex == "" {
			log.LogAttrs(ctx, slog.LevelWarn, "-acme-host-match is not set. Malicious clients can cause invalid ACME requests.")
		} else {
			re, err := regexp.Compile(v.ACMEHostRegex)
			if err != nil {
				return server.Config{}, fmt.Errorf("-acme-host-match regexp %q could not be compiled: %w", v.ACMEHostRegex, err)
			}
			hostPolicy = func(ctx context.Context, host string) error {
				if !re.MatchString(host) {
					return errors.New("host not allowed")
				}
				return nil
			}
		}
		result.ACME = &autocert.Manager{
			Prompt:     autocert.AcceptTOS,
			Cache:      autocert.DirCache(v.ACMEDir),
			HostPolicy: hostPolicy,
			Email:      v.ACMEEmail,
		}
	}

	return result, nil
}

func (v *Values) LoadJSON(r io.Reader) error {
	decoder := json.NewDecoder(r)
	decoder.DisallowUnknownFields()
	return decoder.Decode(v)
}

func (v *Values) LoadJSONFile(filename string) (err error) {
	var f *os.File
	f, err = os.Open(filename)
	if err != nil {
		return err
	}
	defer func() {
		if err2 := f.Close(); err2 != nil {
			err = errors.Join(err, err2)
		}
	}()
	return v.LoadJSON(f)
}

func (v *Values) LoadUserConfig() error {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return fmt.Errorf("error getting user configuration directory: %w", err)
	}
	return v.LoadJSONFile(filepath.Join(configDir, "hydrui", "config.json"))
}

func (v *Values) SaveJSON(w io.Writer) error {
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "\t")
	encoder.SetEscapeHTML(false)
	return encoder.Encode(v)
}

func (v *Values) SaveJSONFile(filename string) (err error) {
	var f *os.File
	f, err = os.Create(filename)
	if err != nil {
		return err
	}
	defer func() {
		if err2 := f.Close(); err2 != nil {
			err = errors.Join(err, err2)
		}
	}()
	return v.SaveJSON(f)
}

func (v *Values) SaveUserConfig() error {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return fmt.Errorf("error getting user configuration directory: %w", err)
	}
	hydruiConfigDir := filepath.Join(configDir, "hydrui")
	if err := os.MkdirAll(hydruiConfigDir, 0755); err != nil {
		return fmt.Errorf("error creating user configuration directory: %w", err)
	}
	return v.SaveJSONFile(filepath.Join(hydruiConfigDir, "config.json"))
}

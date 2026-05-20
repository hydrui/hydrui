package server

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/hydrui/hydrui/internal/pack"
	"golang.org/x/sync/errgroup"
)

type Manager struct {
	statusCh  chan StatusMessage
	commandCh chan commandMessage
}

func NewManager(ctx context.Context, log *slog.Logger, clientData *pack.Pack) *Manager {
	s := &Manager{
		statusCh:  make(chan StatusMessage),
		commandCh: make(chan commandMessage),
	}
	var (
		httpServer     *http.Server
		httpsServer    *http.Server
		internalServer *http.Server
	)
	shutdownServer := func() error {
		shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		group, _ := errgroup.WithContext(shutdownCtx)
		if httpServer != nil {
			group.Go(func() error {
				err := httpServer.Shutdown(shutdownCtx)
				if err != nil && err != http.ErrServerClosed {
					log.LogAttrs(ctx, slog.LevelError, "Failed to shutdown HTTP server.", slog.Any("error", err))
				}
				return err
			})
		}
		if httpsServer != nil {
			group.Go(func() error {
				err := httpsServer.Shutdown(shutdownCtx)
				if err != nil && err != http.ErrServerClosed {
					log.LogAttrs(ctx, slog.LevelError, "Failed to shutdown HTTPS server.", slog.Any("error", err))
				}
				return err
			})
		}
		if internalServer != nil {
			group.Go(func() error {
				err := internalServer.Shutdown(shutdownCtx)
				if err != nil && err != http.ErrServerClosed {
					log.LogAttrs(ctx, slog.LevelError, "Failed to shutdown internal server.", slog.Any("error", err))
				}
				return err
			})
		}
		if err := group.Wait(); err != nil {
			log.LogAttrs(ctx, slog.LevelError, "Error during server shutdown.", slog.Any("error", err))
			return err
		}
		httpServer = nil
		httpsServer = nil
		internalServer = nil
		return nil
	}
	startServer := func(config Config) {
		server := New(config, clientData)
		newHttpServer := &http.Server{}
		newHttpsServer := &http.Server{}
		newInternalServer := &http.Server{}
		startedMessage := StatusStarted{}

		// Configure listeners
		httpListener, err := newListener(config.Listen, config.Socket, config.SocketPerms)
		if err != nil {
			s.statusCh <- StatusError{Error: fmt.Errorf("error listening for HTTP connections: %w", err)}
			return
		}
		if httpListener != nil {
			startedMessage.Address = httpListener.Addr()
		}
		httpsListener, err := newListener(config.ListenTLS, config.SocketTLS, config.SocketPerms)
		if err != nil {
			s.statusCh <- StatusError{Error: fmt.Errorf("error listening for HTTPS connections: %w", err)}
			return
		}
		if httpsListener != nil {
			startedMessage.AddressTLS = httpsListener.Addr()
		}
		var internalListener net.Listener
		if config.ListenInternal != "" {
			internalListener, err = newListener(config.ListenInternal, config.SocketInternal, config.SocketPerms)
			if err != nil {
				s.statusCh <- StatusError{Error: fmt.Errorf("error listening for internal connections: %w", err)}
				return
			}
			if internalListener != nil {
				startedMessage.AddressInternal = internalListener.Addr()
			}
		}
		if httpListener == nil && httpsListener == nil {
			s.statusCh <- StatusError{Error: errors.New("no listeners configured")}
			return
		}

		// HTTP -> HTTPS redirector, when using both HTTP and HTTPS.
		httpsRedirector := http.HandlerFunc(
			func(w http.ResponseWriter, r *http.Request) {
				if r.Method != "GET" && r.Method != "HEAD" {
					http.Error(w, "Use HTTPS", http.StatusBadRequest)
					return
				}
				host, _, err := net.SplitHostPort(r.Host)
				if err != nil {
					host = r.Host
				} else if tcpAddr, ok := httpsListener.Addr().(*net.TCPAddr); ok {
					host = net.JoinHostPort(host, strconv.Itoa(tcpAddr.Port))
				} else {
					host = net.JoinHostPort(host, "443")
				}
				http.Redirect(w, r, "https://"+host+r.URL.RequestURI(), http.StatusFound)
			},
		)

		// Configure handlers
		newHttpsServer.Handler = server.External
		if config.ACME != nil {
			newHttpServer.Handler = config.ACME.HTTPHandler(httpsRedirector)
		} else if httpsListener != nil {
			newHttpServer.Handler = httpsRedirector
		} else {
			newHttpServer.Handler = server.External
		}
		newInternalServer.Handler = server.Internal

		// Save the new servers before sending any events.
		if httpListener != nil {
			httpServer = newHttpServer
		} else {
			httpServer = nil
		}
		if httpsListener != nil {
			httpsServer = newHttpsServer
		} else {
			httpsServer = nil
		}
		if internalListener != nil {
			internalServer = newInternalServer
		} else {
			internalServer = nil
		}

		// Broadcast status, before starting the server to ensure the order of events is logical.
		s.statusCh <- startedMessage

		if httpListener != nil {
			go func() {
				if err := newHttpServer.Serve(httpListener); err != nil && err != http.ErrServerClosed {
					s.statusCh <- StatusError{Error: fmt.Errorf("error in HTTP server: %w", err)}
				}
			}()
		}
		if httpsListener != nil {
			go func() {
				var tlsConfig *tls.Config
				if config.TLSCertFile != "" && config.TLSKeyFile != "" {
					log.Info("Loading TLS keypair from filesystem.", "cert", config.TLSCertFile, "key", config.TLSKeyFile)
					tlsConfig = &tls.Config{}
					cert, err := tls.LoadX509KeyPair(config.TLSCertFile, config.TLSKeyFile)
					if err != nil {
						s.statusCh <- StatusError{Error: fmt.Errorf("error loading static TLS keypair: %w", err)}
						return
					}
					tlsConfig.Certificates = append(tlsConfig.Certificates, cert)
				} else if config.ACME != nil {
					tlsConfig = config.ACME.TLSConfig()
				} else {
					log.Info("Generating self-signed TLS certificate. This should only be used for testing purposes.")
					log.Info("It is recommended to use ACME or provide TLS certificates via -tls-cert-file and -tls-key-file.")
					tlsConfig = &tls.Config{}
					cert, err := generateSelfSignedCert()
					if err != nil {
						s.statusCh <- StatusError{Error: fmt.Errorf("error generating self-signed TLS keypair: %w", err)}
						return
					}
					tlsConfig.Certificates = append(tlsConfig.Certificates, cert)
				}
				if err := newHttpsServer.Serve(tls.NewListener(httpsListener, tlsConfig)); err != nil && err != http.ErrServerClosed {
					s.statusCh <- StatusError{Error: fmt.Errorf("error in HTTPS server: %w", err)}
				}
			}()
		}
		if internalListener != nil {
			go func() {
				if err := newInternalServer.Serve(internalListener); err != nil && err != http.ErrServerClosed {
					s.statusCh <- StatusError{Error: fmt.Errorf("error in internal HTTP server: %w", err)}
				}
			}()
		}
	}
	go func() {
		for cmd := range s.commandCh {
			switch c := cmd.(type) {
			case commandConfigureServer:
				_ = shutdownServer()
				startServer(c.Config)
			case commandStopServer:
				_ = shutdownServer()
			}
		}
		if err := shutdownServer(); err == nil {
			close(s.statusCh)
		}
	}()
	return s
}

func (s *Manager) StatusChannel() <-chan StatusMessage {
	return s.statusCh
}

func (s *Manager) Configure(config Config) {
	s.commandCh <- commandConfigureServer{config}
}

func (s *Manager) Stop() {
	s.commandCh <- commandStopServer{}
}

func (s *Manager) Close() {
	s.commandCh <- commandStopServer{}
	close(s.commandCh)
	for range s.statusCh {
	}
}

type StatusMessage interface {
	isStatusMessage()
}

type StatusStarted struct {
	Address         net.Addr
	AddressTLS      net.Addr
	AddressInternal net.Addr
}

func (StatusStarted) isStatusMessage() {}

type StatusStopped struct{}

func (StatusStopped) isStatusMessage() {}

type StatusError struct {
	Error error
}

func (StatusError) isStatusMessage() {}

type commandMessage interface {
	isCommandMessage()
}

type commandConfigureServer struct{ Config Config }

func (commandConfigureServer) isCommandMessage() {}

type commandStopServer struct{}

func (commandStopServer) isCommandMessage() {}

func generateSelfSignedCert() (tls.Certificate, error) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return tls.Certificate{}, err
	}

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			Organization: []string{"Hydrui"},
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              []string{"localhost"},
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		return tls.Certificate{}, err
	}

	return tls.Certificate{
		Certificate: [][]byte{derBytes},
		PrivateKey:  priv,
	}, nil
}

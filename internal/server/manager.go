package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
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
		httpServer  *http.Server
		httpsServer *http.Server
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
				err := httpServer.Shutdown(shutdownCtx)
				if err != nil && err != http.ErrServerClosed {
					log.LogAttrs(ctx, slog.LevelError, "Failed to shutdown HTTPS server.", slog.Any("error", err))
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
		return nil
	}
	startServer := func(config Config) {
		handler := New(config, clientData)
		newHttpServer := &http.Server{}
		newHttpsServer := &http.Server{}
		startedMessage := StatusStarted{}

		// Configure listeners
		httpListener, err := newListener(config.Listen, config.Socket)
		if err != nil {
			s.statusCh <- StatusError{Error: fmt.Errorf("error listening for HTTP connections: %w", err)}
			return
		}
		if httpListener != nil {
			startedMessage.Address = httpListener.Addr()
		}
		httpsListener, err := newListener(config.ListenTLS, config.SocketTLS)
		if err != nil {
			s.statusCh <- StatusError{Error: fmt.Errorf("error listening for HTTPS connections: %w", err)}
			return
		}
		if httpsListener != nil {
			startedMessage.AddressTLS = httpsListener.Addr()
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
		newHttpsServer.Handler = handler
		if config.ACME != nil {
			newHttpServer.Handler = config.ACME.HTTPHandler(httpsRedirector)
		} else if httpsListener != nil {
			newHttpServer.Handler = httpsRedirector
		} else {
			newHttpServer.Handler = handler
		}

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
				if err := newHttpsServer.Serve(httpListener); err != nil && err != http.ErrServerClosed {
					s.statusCh <- StatusError{Error: fmt.Errorf("error in HTTP server: %w", err)}
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
	Address    net.Addr
	AddressTLS net.Addr
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

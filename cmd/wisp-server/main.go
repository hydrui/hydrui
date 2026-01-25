// Simple Wisp server for proxying connections.

package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime/pprof"
	"slices"
	"strings"
	"syscall"

	"github.com/gorilla/websocket"
	"github.com/hydrui/hydrui/internal/wisp"
)

func main() {
	cpuprofile := flag.String("cpuprofile", "", "write cpu profile to file")
	listen := flag.String("listen", ":8080", "listen address")
	destinations := flag.String("destinations", "*", "comma-separated whitelist of allowed destinations")
	origins := flag.String("origins", "*", "comma-separated whitelist of allowed origins, or * for all")
	flag.Parse()

	originsList := strings.Split(*origins, ",")
	destinationsList := strings.Split(*destinations, ",")

	if *cpuprofile != "" {
		f, err := os.Create(*cpuprofile)
		if err != nil {
			panic(err)
		}
		_ = pprof.StartCPUProfile(f)
		defer pprof.StopCPUProfile()
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	handler := wisp.NewServer(
		wisp.NewBuiltinDialer(
			wisp.Whitelist(destinationsList),
		),
		wisp.WithLogger(log),
		wisp.WithUpgrader(websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				if *origins == "*" {
					return true
				}
				return slices.Contains(originsList, r.Header.Get("Origin"))
			},
		}),
	)
	server := http.Server{
		Addr: *listen,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			log.Info(
				"Request",
				slog.String("method", r.Method),
				slog.String("url", r.URL.String()),
				slog.String("remote", r.RemoteAddr),
			)
			handler.ServeHTTP(w, r)
		}),
	}
	go func() {
		log.Info("Listening for connections", slog.String("address", *listen))
		log.Error("Server failed", slog.Any("error", server.ListenAndServe()))
	}()

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)
	<-signalChan
	log.Info("Shutting down")
	if err := server.Shutdown(context.Background()); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("Shutdown failed", slog.Any("error", err))
	}
}

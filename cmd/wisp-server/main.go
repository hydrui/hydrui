// Simple Wisp server for proxying connections.

package main

import (
	"context"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime/pprof"
	"strings"
	"syscall"

	"github.com/hydrui/hydrui/internal/wisp"
)

func main() {
	cpuprofile := flag.String("cpuprofile", "", "write cpu profile to file")
	listen := flag.String("listen", ":8080", "listen address")
	whitelist := flag.String("whitelist", "*", "comma-separated whitelist of allowed origins")
	flag.Parse()
	if *cpuprofile != "" {
		f, err := os.Create(*cpuprofile)
		if err != nil {
			panic(err)
		}
		_ = pprof.StartCPUProfile(f)
		defer pprof.StopCPUProfile()
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	handler := wisp.NewServer(wisp.NewBuiltinDialer(wisp.Whitelist(strings.Split(*whitelist, ","))), wisp.WithLogger(log))
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
	if err := server.Shutdown(context.Background()); err != nil {
		log.Error("Shutdown failed", slog.Any("error", err))
	}
}

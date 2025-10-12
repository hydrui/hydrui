package main

import (
	"context"
	_ "embed"
	"flag"
	"log/slog"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"golang.org/x/text/language"

	"github.com/hydrui/hydrui/internal/server"
	"github.com/hydrui/hydrui/internal/webdata"
)

var (
	langs = []language.Tag{
		language.English,
	}
	matcher = language.NewMatcher(langs)
)

func main() {
	listen := flag.String("listen", ":8080", "Listen address")
	flag.Parse()
	log := slog.Default()

	hydruiHandler := server.New(server.Config{
		Listen:         *listen,
		Secure:         true,
		ServerMode:     false,
		AllowBugReport: false,
	}, webdata.Client).External
	server := &http.Server{
		Addr: *listen,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/":
				accept := r.Header.Get("Accept-Language")
				_, index := language.MatchStrings(matcher, accept)
				http.Redirect(w, r, "/"+langs[index].String()+"/", http.StatusFound)
			case "/client":
				r.URL.Path = "/"
				hydruiHandler.ServeHTTP(w, r)
			default:
				if _, ok := webdata.Site.ResolvePath(r.URL.Path); ok {
					webdata.Site.ServeHTTP(w, r)
				} else {
					hydruiHandler.ServeHTTP(w, r)
				}
			}
		}),
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		log.LogAttrs(context.Background(), slog.LevelInfo, "Listening for HTTP connections.", slog.String("address", *listen))
		err := server.ListenAndServe()
		if err != nil {
			log.LogAttrs(context.Background(), slog.LevelError, "Error in HTTP server.", slog.Any("error", err))
		}
	}()

	<-ctx.Done()
	stop()

	shutdownCtx, shutdownStop := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownStop()

	err := server.Shutdown(shutdownCtx)
	if err != nil && err != http.ErrServerClosed {
		log.LogAttrs(context.Background(), slog.LevelError, "Failed to shut down HTTP server.", slog.Any("error", err))
	}

	log.LogAttrs(context.Background(), slog.LevelInfo, "Exiting gracefully.")
}

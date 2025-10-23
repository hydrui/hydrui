package main

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hydrui/hydrui/internal/options"
	"github.com/hydrui/hydrui/internal/server"
	"github.com/hydrui/hydrui/internal/webdata"
)

func startCLI(ctx context.Context, log *slog.Logger) {
	opts := options.NewDefault()
	opts.ParseEnv()
	err := opts.ParseFlags(os.Args)
	if err != nil {
		log.LogAttrs(ctx, slog.LevelError, "Invalid command line arguments.", slog.Any("error", err))
		os.Exit(1)
	}
	if opts.FlagSet.Arg(0) == "healthcheck" {
		dest := opts.FlagSet.Arg(1)
		client := http.Client{
			Timeout: 10 * time.Second,
		}
		resp, err := client.Get(dest)
		if err != nil {
			log.LogAttrs(ctx, slog.LevelError, "Healthcheck request failed.", slog.Any("error", err))
			os.Exit(3)
		}
		_, err = io.Copy(os.Stdout, resp.Body)
		if err != nil {
			log.LogAttrs(ctx, slog.LevelError, "Error during HTTP recv.", slog.Any("error", err))
			os.Exit(2)
		}
		resp.Body.Close()
		if resp.StatusCode >= 400 {
			os.Exit(1)
		} else {
			os.Exit(0)
		}
	}
	config, err := opts.ServerConfig(ctx, log)
	if err != nil {
		log.LogAttrs(ctx, slog.LevelError, "Configuration error.", slog.Any("error", err))
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	manager := server.NewManager(ctx, log, webdata.Client)
	manager.Configure(config)

MainLoop:
	for {
		select {
		case <-ctx.Done():
			break MainLoop
		case status := <-manager.StatusChannel():
			switch t := status.(type) {
			case server.StatusStarted:
				logAttrs := []slog.Attr{}
				if t.Address != nil {
					logAttrs = append(logAttrs, slog.String("listen", t.Address.String()))
				}
				if t.AddressTLS != nil {
					logAttrs = append(logAttrs, slog.String("listen_tls", t.AddressTLS.String()))
				}
				log.LogAttrs(ctx, slog.LevelInfo, "Server was started.", logAttrs...)
			case server.StatusStopped:
				log.LogAttrs(ctx, slog.LevelInfo, "Server was stopped.")
				break MainLoop
			case server.StatusError:
				log.LogAttrs(ctx, slog.LevelError, "Server error.", slog.Any("error", t.Error))
			}
		}
	}

	log.Info("Shutting down.")
	manager.Close()
	stop()

	log.LogAttrs(ctx, slog.LevelInfo, "Exiting gracefully.")
}

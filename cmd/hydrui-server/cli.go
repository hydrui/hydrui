package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

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

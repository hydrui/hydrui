package main

import (
	"context"
	_ "embed"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hydrui/hydrui/internal/bugreport"
	"github.com/hydrui/hydrui/internal/options"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

func main() {
	listen := flag.String("listen", ":8080", "Listen address")
	storageEndpoint := options.Secret(flag.CommandLine, "storage-endpoint", "", "storage endpoint URL")
	storageBucket := options.Secret(flag.CommandLine, "storage-bucket", "", "storage bucket")
	storagePrefix := options.Secret(flag.CommandLine, "storage-prefix", "", "storage prefix")
	storageAccessKeyID := options.Secret(flag.CommandLine, "storage-access-key-id", "", "storage access key ID")
	storageSecretAccessKey := options.Secret(flag.CommandLine, "storage-secret-access-key", "", "storage secret access key")
	storageSecure := flag.Bool("storage-secure", false, "Whether to enable HTTPS for connecting to storage")
	flag.Parse()
	log := slog.Default()
	if *storageEndpoint == "" {
		log.LogAttrs(context.Background(), slog.LevelError, "Required option -storage-endpoint not set.")
		os.Exit(1)
	}
	minioClient, err := minio.New(*storageEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(*storageAccessKeyID, *storageSecretAccessKey, ""),
		Secure: *storageSecure,
	})
	if err != nil {
		log.LogAttrs(context.Background(), slog.LevelError, "Error initializing Minio client.", slog.Any("error", err))
		os.Exit(1)
	}
	report := bugreport.NewHandler(
		minioClient,
		*storagePrefix,
		*storageBucket,
		&bugreport.HydruiDevKey,
		log,
	)
	mux := http.NewServeMux()
	mux.Handle("/bug-report", report)
	server := &http.Server{
		Addr:    *listen,
		Handler: mux,
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
	if err := server.Shutdown(shutdownCtx); err != nil && err != http.ErrServerClosed {
		log.LogAttrs(context.Background(), slog.LevelError, "Failed to shut down HTTP server.", slog.Any("error", err))
	}
	log.LogAttrs(context.Background(), slog.LevelInfo, "Exiting gracefully.")
}

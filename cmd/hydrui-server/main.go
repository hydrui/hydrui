package main

import (
	"context"
	"log/slog"

	// Embed timezone data in case it can't be located on the system.
	_ "time/tzdata"

	// Embed CA certificates in case it can't be located on the system.
	_ "github.com/breml/rootcerts"
)

//go:generate go run github.com/josephspurrier/goversioninfo/cmd/goversioninfo@v1.5.0 -manifest hydrui-server.manifest -platform-specific=true

func main() {
	ctx := context.Background()
	if !startUI(ctx) {
		log := slog.Default()
		startCLI(ctx, log)
	}
}

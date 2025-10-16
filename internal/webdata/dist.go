package webdata

import (
	_ "embed"

	"github.com/hydrui/hydrui/internal/pack"
)

var (
	//go:embed client.pack
	clientPack []byte

	// Client contains the Hydrui client code.
	Client = pack.Parse(clientPack)
)

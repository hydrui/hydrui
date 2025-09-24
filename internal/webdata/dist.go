package webdata

import (
	_ "embed"

	"github.com/hydrui/hydrui/internal/pack"
)

var (
	//go:embed client.pack
	clientPack []byte

	//go:embed site.pack
	sitePack []byte

	// Client contains the Hydrui client code.
	Client = pack.Parse(clientPack)

	// Site contains the Hydrui "landing page" website.
	Site = pack.Parse(sitePack)
)

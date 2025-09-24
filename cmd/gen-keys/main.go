package main

import (
	"crypto/rand"
	"flag"
	"log"
	"os"

	"golang.org/x/crypto/nacl/box"
)

func main() {
	out := flag.String("out", "hydrui-key", "Basename to use for outputting generated keys")
	flag.Parse()
	pub, key, err := box.GenerateKey(rand.Reader)
	if err != nil {
		log.Fatalf("Error generating keys: %v", err)
	}
	if err := os.WriteFile(*out+".pub", pub[:], 0644); err != nil {
		log.Fatalf("Error writing public key: %v", err)
	}
	if err := os.WriteFile(*out+".key", key[:], 0600); err != nil {
		log.Fatalf("Error writing private key: %v", err)
	}
}

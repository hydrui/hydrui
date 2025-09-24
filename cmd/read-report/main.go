package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"io"
	"log"
	"os"

	"github.com/hydrui/hydrui/internal/crypt"
	"golang.org/x/crypto/curve25519"
)

const expectedFileHeader = "EncryptedReport\x00Meta"
const expectedDataHeader = "Data"
const expectedFooter = "EOF\x00"

func main() {
	privateKeyFilename := flag.String("private-key", "", "private key to decrypt with")
	decryptInner := flag.Bool("decrypt-inner", true, "Whether or not to decrypt inner (client) payload")
	decryptInnerOnly := flag.Bool("decrypt-inner-only", false, "Whether or not to treat the file as a raw inner payload")
	flag.Parse()
	if flag.NArg() != 2 {
		log.Fatal("Error: Provide an input and output filename.")
	}

	inputFilename := flag.Arg(0)
	inputFile, err := os.Open(inputFilename)
	if err != nil {
		log.Fatalf("Error: Could not open input file %q: %v", inputFilename, err)
	}
	defer func() {
		if err := inputFile.Close(); err != nil {
			log.Printf("Warning: Error closing input file %q: %v", inputFilename, err)
		}
	}()

	outputFilename := flag.Arg(1)
	outputFile, err := os.Create(outputFilename)
	if err != nil {
		log.Fatalf("Error: Could not open output file %q: %v", outputFilename, err)
	}
	defer func() {
		if err := outputFile.Close(); err != nil {
			log.Printf("Warning: Error closing output file %q: %v", outputFilename, err)
		}
	}()

	var privateKey [32]byte
	privateKeyFile, err := os.Open(*privateKeyFilename)
	if err != nil {
		log.Fatalf("Error: Could not open public key file %q: %v", *privateKeyFilename, err)
	}
	defer func() {
		if err := privateKeyFile.Close(); err != nil {
			log.Printf("Warning: Error cloding private key file %q: %v", *privateKeyFilename, err)
		}
	}()
	if _, err := io.ReadFull(privateKeyFile, privateKey[:]); err != nil {
		log.Fatalf("Error: Could not read public key file %q: %v", *privateKeyFilename, err)
	}
	var publicKey [32]byte
	curve25519.ScalarBaseMult(&publicKey, &privateKey)

	if !*decryptInnerOnly {
		buf := [20]byte{}
		if _, err := io.ReadFull(inputFile, buf[:20]); err != nil {
			log.Fatalf("Error: Could not read input file header of file %q: %v", inputFilename, err)
		}
		if !bytes.Equal(buf[:20], []byte(expectedFileHeader)) {
			log.Fatalf("Error: Invalid file header: expected %v, got %v", []byte(expectedFileHeader), buf[:20])
		}

		metadata := map[string]any{}
		if err := json.NewDecoder(crypt.DecryptReader(inputFile, &publicKey, &privateKey)).Decode(&metadata); err != nil {
			log.Printf("Warning: Error decoding metadata: %v", err)
		} else {
			log.Printf("Metadata: %#v", metadata)
		}

		if _, err := io.ReadFull(inputFile, buf[:4]); err != nil {
			log.Fatalf("Error: Could not read input file header of file %q: %v", inputFilename, err)
		}
		if !bytes.Equal(buf[:4], []byte(expectedDataHeader)) {
			log.Fatalf("Error: Invalid data header: expected %v, got %v", []byte(expectedDataHeader), buf[:20])
		}

		dataReader := crypt.DecryptReader(inputFile, &publicKey, &privateKey)
		if *decryptInner {
			dataReader = crypt.DecryptReader(dataReader, &publicKey, &privateKey)
		}
		if _, err := io.Copy(outputFile, dataReader); err != nil {
			log.Fatalf("Error: Could not decrypt data payload of file %q: %v", inputFilename, err)
		}

		if _, err := io.ReadFull(inputFile, buf[:4]); err != nil {
			log.Fatalf("Error: Could not read input file header of file %q: %v", inputFilename, err)
		}
		if !bytes.Equal(buf[:4], []byte(expectedFooter)) {
			log.Fatalf("Error: Invalid footer: expected %v, got %v", []byte(expectedFooter), buf[:4])
		}
	} else {
		if _, err := io.Copy(outputFile, crypt.DecryptReader(inputFile, &publicKey, &privateKey)); err != nil {
			log.Fatalf("Error: Could not decrypt file %q: %v", inputFilename, err)
		}
	}
}

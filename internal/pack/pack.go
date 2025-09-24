package pack

import (
	"bytes"
	"encoding/binary"
	"io"

	"github.com/andybalholm/brotli"
)

type Pack struct {
	Files      map[string][]byte
	Compressed map[string][]byte
}

type fileHeader struct {
	FileSize   uint32
	Flags      uint16
	PathLength uint16
}

func Parse(pack []byte) *Pack {
	result := &Pack{
		Files:      make(map[string][]byte),
		Compressed: make(map[string][]byte),
	}

	r := bytes.NewReader(pack)
	for {
		header := fileHeader{}
		err := binary.Read(r, binary.LittleEndian, &header)
		if err == io.EOF {
			break
		} else if err != nil {
			panic(err)
		}
		nameBytes, err := io.ReadAll(io.LimitReader(r, int64(header.PathLength)))
		if err != nil {
			panic(err)
		}
		name := string(nameBytes)
		fileReader := io.LimitReader(r, int64(header.FileSize))
		if header.Flags == 1 {
			compressed := &bytes.Buffer{}
			uncompressed, err := io.ReadAll(
				brotli.NewReader(
					io.TeeReader(
						fileReader,
						compressed,
					),
				),
			)
			if err != nil {
				panic(err)
			}
			result.Compressed[name] = compressed.Bytes()
			result.Files[name] = uncompressed
		} else {
			uncompressed, err := io.ReadAll(fileReader)
			if err != nil {
				panic(err)
			}
			result.Files[name] = uncompressed
		}

	}

	return result
}

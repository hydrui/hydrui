package crypt

import (
	"encoding/binary"
	"errors"
	"io"

	"golang.org/x/crypto/nacl/box"
)

// DecryptReader wraps a Reader, encrypting 32-bit-length-prefixed anonymous
// NaCl boxes.
func DecryptReader(r io.Reader, publicKey *[32]byte, privateKey *[32]byte) io.Reader {
	return &decryptedReader{r, publicKey, privateKey, nil}
}

type decryptedReader struct {
	r  io.Reader
	pk *[32]byte
	sk *[32]byte
	b  []byte
}

func (l *decryptedReader) Read(p []byte) (n int, err error) {
	for n < len(p) {
		if len(l.b) > 0 {
			v := copy(p[n:], l.b)
			n += v
			l.b = l.b[v:]
			if len(l.b) == 0 {
				l.b = nil
			}
		} else {
			buf := make([]byte, 4)
			if _, err = io.ReadFull(l.r, buf); err != nil {
				return n, err
			}
			chunkLen := binary.BigEndian.Uint32(buf)
			if chunkLen == 0 {
				return n, io.EOF
			}
			buf = make([]byte, chunkLen)
			if _, err = io.ReadFull(l.r, buf); err != nil {
				return n, err
			}
			l.b = make([]byte, chunkLen-box.AnonymousOverhead)
			if _, ok := box.OpenAnonymous(l.b[:0], buf, l.pk, l.sk); !ok {
				return n, errors.New("invalid box")
			}
		}
	}
	return n, nil
}

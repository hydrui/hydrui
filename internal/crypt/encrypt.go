package crypt

import (
	"encoding/binary"
	"errors"
	"io"

	"golang.org/x/crypto/nacl/box"
)

const cryptChunkSize = 8192
const cryptChunkLengthSize = 4
const cryptChunkOverhead = cryptChunkLengthSize + box.AnonymousOverhead

// EncryptReader wraps a Reader, encrypting every 8192 bytes with anonymous
// 32-bit-length-prefixed NaCl boxes.
func EncryptReader(r io.Reader, recipient *[32]byte) io.Reader {
	return &encryptedReader{r, recipient, nil}
}

func Size(size int64) int64 {
	return size + cryptOverhead(size)
}

func cryptOverhead(size int64) int64 {
	boxes := (size + cryptChunkSize - 1) / cryptChunkSize
	return boxes * cryptChunkOverhead
}

type encryptedReader struct {
	r io.Reader
	k *[32]byte
	b []byte
}

func (l *encryptedReader) Read(p []byte) (n int, err error) {
	var chunk [cryptChunkSize]byte
	for n < len(p) {
		if len(l.b) > 0 {
			v := copy(p[n:], l.b)
			n += v
			l.b = l.b[v:]
			if len(l.b) == 0 {
				l.b = nil
			}
			continue
		}
		m, err := io.ReadFull(l.r, chunk[:])
		if errors.Is(err, io.ErrUnexpectedEOF) {
			// ErrUnexpectedEOF is OK: we're just using ReadFull to ensure that we get an
			// entire chunk if there is still an entire chunk left to receive, but on the
			// last chunk, it can be shorter.
		} else if err != nil {
			return n, err
		}
		l.b = make([]byte, cryptChunkLengthSize, m+cryptChunkOverhead)
		binary.BigEndian.PutUint32(l.b[:cryptChunkLengthSize], uint32(m+box.AnonymousOverhead))
		if l.b, err = box.SealAnonymous(l.b, chunk[:m], l.k, nil); err != nil {
			return n, err
		}
	}
	return n, nil
}

package server

import (
	"bufio"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"io"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// HashType represents the type of hash used in the htpasswd file.
type HashType int

//go:generate go run golang.org/x/tools/cmd/stringer@v0.31.0 -type=HashType
const (
	// HashTypeUnknown is the zero value for HashType.
	HashTypeUnknown HashType = iota
	// HashTypeBcrypt is set for bcrypt hashes.
	HashTypeBcrypt
	// HashTypeSHA1 is set for SHA1 hashes.
	HashTypeSHA1
)

type User struct {
	Username string
	Hash     string
	HashType HashType
}

// HtpasswdFile represents a parsed htpasswd file.
type HtpasswdFile struct {
	Users map[string]User
}

// LoadHtpasswdFile loads and parses an htpasswd file.
func LoadHtpasswdFile(file io.Reader) (*HtpasswdFile, error) {
	htpasswd := &HtpasswdFile{
		Users: make(map[string]User),
	}

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		username := parts[0]
		hash := parts[1]

		var hashType HashType
		if strings.HasPrefix(hash, "$2y$") || strings.HasPrefix(hash, "$2a$") || strings.HasPrefix(hash, "$2b$") {
			hashType = HashTypeBcrypt
		} else if strings.HasPrefix(hash, "{SHA}") {
			hashType = HashTypeSHA1
			hash = hash[5:]
		} else {
			// Skip unsupported hash types
			continue
		}

		htpasswd.Users[username] = User{
			Username: username,
			Hash:     hash,
			HashType: hashType,
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return htpasswd, nil
}

// Authenticate checks if the provided username and password match a user in the htpasswd file.
func (h *HtpasswdFile) Authenticate(username, password string) (bool, error) {
	user, exists := h.Users[username]
	if !exists {
		return false, nil
	}

	switch user.HashType {
	case HashTypeBcrypt:
		err := bcrypt.CompareHashAndPassword([]byte(user.Hash), []byte(password))
		return err == nil, nil
	case HashTypeSHA1:
		decodedHash, err := base64.StdEncoding.DecodeString(user.Hash)
		if err != nil {
			return false, err
		}

		h := sha1.New()
		h.Write([]byte(password))
		calculatedHash := h.Sum(nil)

		return subtle.ConstantTimeCompare(decodedHash, calculatedHash) == 1, nil
	default:
		return false, errors.New("unsupported hash type")
	}
}

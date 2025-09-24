package options

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
)

// Returns the directory appropriate for storing local state.
func userStateDir() (string, error) {
	var dir string

	switch runtime.GOOS {
	case "windows":
		dir = os.Getenv("LocalAppData")
		if dir == "" {
			return "", errors.New("%LocalAppData% is not defined")
		}

	case "darwin", "ios":
		dir = os.Getenv("HOME")
		if dir == "" {
			return "", errors.New("$HOME is not defined")
		}
		dir += "/Library/Application Support"

	case "plan9":
		dir = os.Getenv("home")
		if dir == "" {
			return "", errors.New("$home is not defined")
		}
		dir += "/lib/state"

	default:
		dir = os.Getenv("XDG_STATE_HOME")
		if dir == "" {
			dir = os.Getenv("HOME")
			if dir == "" {
				return "", errors.New("neither $XDG_STATE_HOME nor $HOME are defined")
			}
			dir += "/.local/state"
		} else if !filepath.IsAbs(dir) {
			return "", errors.New("path in $XDG_STATE_HOME is relative")
		}
	}

	return dir, nil
}

func appSubDir() string {
	switch runtime.GOOS {
	case "windows":
		return "Hydrui"
	case "darwin", "ios":
		return "dev.hydrui.server"
	default:
		return "hydrui"
	}
}

func appStateDir() (string, error) {
	stateDir, err := userStateDir()
	if err != nil {
		return "", err
	}
	appDir := filepath.Join(stateDir, appSubDir())
	if err := os.MkdirAll(appDir, 0700); err != nil {
		return "", err
	}
	return appDir, nil
}

func getDefaultSecretFile() (string, error) {
	dir, err := appStateDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "secret"), nil
}

func generateSecret() (string, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return "", fmt.Errorf("failed to generate random key: %w", err)
	}
	return base64.StdEncoding.EncodeToString(key), nil
}

func getOrCreateSecret(filename string) (secret string, err error) {
	var f *os.File
	f, err = os.Open(filename)
	if errors.Is(err, fs.ErrNotExist) {
		f, err = os.Create(filename)
		if err != nil {
			return "", fmt.Errorf("creating secret file at %q: %w", filename, err)
		}
		defer func() {
			if err2 := f.Close(); err2 != nil {
				err = errors.Join(err, err2)
			}
		}()
		secret, err := generateSecret()
		if err != nil {
			return "", fmt.Errorf("generating secret file at %q: %w", filename, err)
		}
		if _, err := io.WriteString(f, secret); err != nil {
			return "", fmt.Errorf("writing secret file at %q: %w", filename, err)
		}
		return secret, nil
	} else if err != nil {
		return "", fmt.Errorf("opening secret file at %q: %w", filename, err)
	}
	defer func() {
		if err2 := f.Close(); err2 != nil {
			err = errors.Join(err, err2)
		}
	}()
	b, err := io.ReadAll(f)
	if err != nil {
		return "", fmt.Errorf("reading secret file at %q: %w", filename, err)
	}
	return string(b), nil
}

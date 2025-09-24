package pack

import (
	"mime"
	"net/http"
	"path"
	"path/filepath"
	"strings"
)

func (pack *Pack) ResolvePath(urlPath string) (string, bool) {
	urlPath = path.Clean(urlPath)

	// Remove leading slash
	urlPath = strings.TrimPrefix(urlPath, "/")

	_, exists := pack.Files[urlPath]
	if !exists {
		if urlPath == "" {
			urlPath = "index.html"
		} else {
			urlPath += "/index.html"
		}
		_, exists = pack.Files[urlPath]
	}
	return urlPath, exists
}

// ServeHTTP implements the http.Handler interface
func (pack *Pack) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	urlPath, exists := pack.ResolvePath(r.URL.Path)
	if !exists {
		http.NotFound(w, r)
		return
	}

	acceptEncoding := r.Header.Get("Accept-Encoding")

	var content []byte

	// TODO: Parse Accept-Encoding header properly.
	if strings.Contains(acceptEncoding, "br") && len(pack.Compressed[urlPath]) > 0 {
		content = pack.Compressed[urlPath]
		w.Header().Set("Content-Encoding", "br")
		w.Header().Set("Vary", "Accept-Encoding")
	} else {
		content = pack.Files[urlPath]
	}

	contentType := mime.TypeByExtension(filepath.Ext(urlPath))
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}

	if urlPath == "/index.html" {
		w.Header().Set("Cache-Control", "no-store")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=31536000")
	}

	_, _ = w.Write(content)
}

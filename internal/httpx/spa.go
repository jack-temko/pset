package httpx

import (
	"io/fs"
	"net/http"
	"strings"
)

func exists(fsys fs.FS, name string) bool {
	_, err := fs.Stat(fsys, name)
	return err == nil
}

// SPAFrom serves the SPA out of an embedded tree whose files sit under
// dir, as //go:embed all:dist leaves them.
func SPAFrom(tree fs.FS, dir string) http.Handler {
	sub, err := fs.Sub(tree, dir)
	if err != nil {
		return notBuiltHandler{}
	}
	return SPA(sub)
}

// SPA returns the handler for a dist directory, degrading to the
// not-built handler when index.html is absent.
func SPA(dist fs.FS) http.Handler {
	if !exists(dist, "index.html") {
		return notBuiltHandler{}
	}
	files := http.FileServerFS(dist)
	return spaHandler{dist: dist, files: files}
}

type spaHandler struct {
	dist  fs.FS
	files http.Handler
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p := strings.TrimPrefix(r.URL.Path, "/")
	if p != "" && exists(h.dist, p) {
		if strings.HasPrefix(p, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		h.files.ServeHTTP(w, r)
		return
	}
	if strings.HasPrefix(p, "assets/") {
		// A missing asset is a broken page, not a client-side route.
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-cache")
	r.URL.Path = "/"
	h.files.ServeHTTP(w, r)
}

type notBuiltHandler struct{}

func (notBuiltHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusServiceUnavailable)
	w.Write([]byte("The web interface is not built into this binary.\n" +
		"Build it with:  cd web && npm install && npm run build\n" +
		"Then rebuild pset:  go build -o pset ./cmd/pset\n"))
}

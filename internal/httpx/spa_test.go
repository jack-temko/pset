package httpx

import (
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

// The embedded build keeps its files under dist/, as //go:embed leaves
// them: the SPA must be served from inside it.
func TestSPAFromServesTheEmbeddedBuild(t *testing.T) {
	tree := fstest.MapFS{
		"dist/index.html":    {Data: []byte("<html>app</html>")},
		"dist/assets/app.js": {Data: []byte("js")},
	}
	h := SPAFrom(tree, "dist")
	for path, want := range map[string]string{"/": "app", "/books/x": "app", "/assets/app.js": "js"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != 200 || !strings.Contains(rec.Body.String(), want) {
			t.Errorf("%s: %d %q", path, rec.Code, rec.Body.String())
		}
	}
	rec := httptest.NewRecorder()
	SPAFrom(fstest.MapFS{"dist/.gitkeep": {}}, "dist").ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != 503 {
		t.Errorf("unbuilt: %d", rec.Code)
	}
}

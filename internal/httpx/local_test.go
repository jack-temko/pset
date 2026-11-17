package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLocalOnly(t *testing.T) {
	served := 0
	h := LocalOnly("127.0.0.1:8420", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		served++
		w.WriteHeader(http.StatusNoContent)
	}))
	for _, tc := range []struct {
		name, method, host, origin string
		want                       int
	}{
		{"the page itself", "GET", "127.0.0.1:8420", "", 204},
		{"localhost", "GET", "localhost:8420", "", 204},
		{"localhost without a port", "GET", "localhost", "", 204},
		{"ipv6 loopback", "GET", "[::1]:8420", "", 204},
		{"a LAN address", "GET", "192.168.1.20:8420", "", 204},
		{"a write from the page", "POST", "127.0.0.1:8420", "http://127.0.0.1:8420", 204},
		{"a write from the dev server", "POST", "localhost:5173", "http://localhost:5173", 204},
		{"a write with no origin (curl)", "POST", "127.0.0.1:8420", "", 204},
		{"a rebound name reading settings", "GET", "rebind.example.com:8420", "", 403},
		{"a rebound name that writes", "POST", "rebind.example.com:8420", "http://rebind.example.com:8420", 403},
		{"another site posting a reset", "POST", "127.0.0.1:8420", "https://evil.example", 403},
		{"a sandboxed page (origin null)", "POST", "127.0.0.1:8420", "null", 403},
		{"another site deleting", "DELETE", "localhost:8420", "https://evil.example", 403},
		{"another site reading", "GET", "localhost:8420", "https://evil.example", 204},
		{"no host at all", "GET", "", "", 403},
	} {
		served = 0
		req := httptest.NewRequest(tc.method, "/api/reset", nil)
		req.Host = tc.host
		if tc.origin != "" {
			req.Header.Set("Origin", tc.origin)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != tc.want {
			t.Errorf("%s: %d, want %d", tc.name, rec.Code, tc.want)
		}
		if (tc.want == 403) != (served == 0) {
			t.Errorf("%s: handler served %d times for a %d", tc.name, served, tc.want)
		}
	}
}

// A server told to listen on a name answers to that name.
func TestLocalOnlyAnswersItsOwnListenName(t *testing.T) {
	h := LocalOnly("pset.home:8420", http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {}))
	for host, want := range map[string]int{"pset.home:8420": 200, "other.home:8420": 403} {
		req := httptest.NewRequest("GET", "/", nil)
		req.Host = host
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Errorf("%s: %d, want %d", host, rec.Code, want)
		}
	}
}

package httpx

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type body struct {
	Name string `json:"name"`
}

func TestHandlers(t *testing.T) {
	mux := http.NewServeMux()
	mux.Handle("GET /r/{id}", Reply(func(r *http.Request) (body, error) { return body{r.PathValue("id")}, nil }))
	mux.Handle("GET /r-fail", Reply(func(r *http.Request) (body, error) { return body{}, NotFound("thing") }))
	mux.Handle("POST /s", Send(http.StatusCreated, func(r *http.Request, in body) (body, error) { return body{"made " + in.Name}, nil }))
	mux.Handle("POST /s-fail", Send(http.StatusCreated, func(r *http.Request, in body) (body, error) { return body{}, errors.New("boom") }))
	mux.Handle("POST /t", Take(func(r *http.Request, in body) error {
		if in.Name == "bad" {
			return Invalid("name", "no")
		}
		return nil
	}))
	mux.Handle("DELETE /a/{id}", Act(func(r *http.Request) error {
		if r.PathValue("id") == "gone" {
			return NotFound("thing")
		}
		return nil
	}))

	do := func(method, path, in string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(in)))
		return rec
	}
	for _, tc := range []struct {
		name, method, path, in string
		code                   int
		out                    string
	}{
		{"reply", "GET", "/r/7", "", 200, `{"name":"7"}`},
		{"reply error", "GET", "/r-fail", "", 404, `"code":"not_found"`},
		{"send", "POST", "/s", `{"name":"x"}`, 201, `{"name":"made x"}`},
		{"send, unknown field", "POST", "/s", `{"nmae":"x"}`, 422, `"code":"invalid"`},
		{"send, service error is not leaked", "POST", "/s-fail", `{}`, 500, `"code":"internal"`},
		{"take", "POST", "/t", `{"name":"x"}`, 204, ``},
		{"take error", "POST", "/t", `{"name":"bad"}`, 422, `"field":"name"`},
		{"act", "DELETE", "/a/1", "", 204, ``},
		{"act error", "DELETE", "/a/gone", "", 404, `"code":"not_found"`},
	} {
		rec := do(tc.method, tc.path, tc.in)
		if rec.Code != tc.code || !strings.Contains(rec.Body.String(), tc.out) {
			t.Errorf("%s: %d %q, want %d containing %q", tc.name, rec.Code, rec.Body.String(), tc.code, tc.out)
		}
	}
	if rec := do("POST", "/s-fail", `{}`); strings.Contains(rec.Body.String(), "boom") {
		t.Errorf("an internal error leaked: %q", rec.Body.String())
	}
}

// A body over the cap is said to be too large, not read as far as it goes
// and reported as cut off.
func TestDecodeSaysWhenABodyIsTooLarge(t *testing.T) {
	big := `{"name":"` + strings.Repeat("a", maxBody+10) + `"}`
	var b body
	err := Decode(httptest.NewRequest("POST", "/", strings.NewReader(big)), &b)
	var e *Error
	if !errors.As(err, &e) || !strings.Contains(e.Message, "too much") {
		t.Fatalf("err = %v", err)
	}
	if err := Decode(httptest.NewRequest("POST", "/", strings.NewReader(`{"name":"ok"}`)), &b); err != nil || b.Name != "ok" {
		t.Fatalf("small body: %v %+v", err, b)
	}
}

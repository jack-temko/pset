package httpx

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/errs"
)

var (
	missing = errs.Define(errs.Entry{ID: "test.missing", What: "That thing isn't there.", Fix: "Go back.", Status: http.StatusNotFound})
	badName = errs.Define(errs.Entry{ID: "test.bad_name", What: "That name won't do.", Scope: errs.ScopeField})
)

type body struct {
	Name string `json:"name"`
}

func TestHandlers(t *testing.T) {
	mux := http.NewServeMux()
	mux.Handle("GET /r/{id}", Reply(func(r *http.Request) (body, error) { return body{r.PathValue("id")}, nil }))
	mux.Handle("GET /r-fail", Reply(func(_ *http.Request) (body, error) { return body{}, missing.New() }))
	mux.Handle("POST /s", Send(http.StatusCreated, func(_ *http.Request, in body) (body, error) { return body{"made " + in.Name}, nil }))
	mux.Handle("POST /s-fail", Send(http.StatusCreated, func(_ *http.Request, _ body) (body, error) { return body{}, errors.New("boom") }))
	mux.Handle("POST /t", Take(func(_ *http.Request, in body) error {
		if in.Name == "bad" {
			return badName.New().OnField("name")
		}
		return nil
	}))
	mux.Handle("DELETE /a/{id}", Act(func(r *http.Request) error {
		if r.PathValue("id") == "gone" {
			return missing.New()
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
		{"reply error", "GET", "/r-fail", "", 404, `"id":"test.missing"`},
		{"send", "POST", "/s", `{"name":"x"}`, 201, `{"name":"made x"}`},
		{"send, unknown field", "POST", "/s", `{"nom":"x"}`, 400, `"id":"request.invalid_json"`},
		{"send, service error is not leaked", "POST", "/s-fail", `{}`, 500, `"id":"internal.unexpected"`},
		{"take", "POST", "/t", `{"name":"x"}`, 204, ``},
		{"take error", "POST", "/t", `{"name":"bad"}`, 422, `"field":"name"`},
		{"act", "DELETE", "/a/1", "", 204, ``},
		{"act error", "DELETE", "/a/gone", "", 404, `"id":"test.missing"`},
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
	if !errors.Is(err, errs.TooLarge) {
		t.Fatalf("err = %v", err)
	}
	if err := Decode(httptest.NewRequest("POST", "/", strings.NewReader(`{"name":"ok"}`)), &b); err != nil || b.Name != "ok" {
		t.Fatalf("small body: %v %+v", err, b)
	}
}

// An /api/ path nothing serves answers in the catalog's shape, never HTML.
func TestUnknownEndpointAnswersRequestNotFound(t *testing.T) {
	rec := httptest.NewRecorder()
	NotFoundAPI(rec, httptest.NewRequest("GET", "/api/nothing", nil))
	if rec.Code != 404 || !strings.Contains(rec.Body.String(), `"id":"request.not_found"`) {
		t.Errorf("%d %q", rec.Code, rec.Body.String())
	}
}

// A client that went away is not a failure: nothing is written, nothing kept.
func TestACancelledRequestIsAnsweredWithNothing(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	rec := httptest.NewRecorder()
	Fail(rec, httptest.NewRequest("GET", "/x", nil).WithContext(ctx), errors.New("boom"))
	if rec.Body.Len() != 0 || rec.Code != 200 {
		t.Errorf("wrote %d %q", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	Fail(rec, httptest.NewRequest("GET", "/x", nil), context.Canceled)
	if rec.Body.Len() != 0 {
		t.Errorf("wrote %q", rec.Body.String())
	}
}

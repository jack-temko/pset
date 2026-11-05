package httpx

import (
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/jackt/pset/internal/errs"
)

// LocalOnly makes the server answer the browser on this machine and
// nothing else it might be tricked into hearing. PSet has no login: the
// data directory, an API key and a reset that wipes everything sit behind
// plain routes, so what stands between them and the web is who is asking.
//
//   - The Host must be a local name: localhost, an IP address, or the name
//     the server was told to listen on. A page on another site can point
//     its own name at this machine (DNS rebinding) and then read the
//     settings, key included; its requests still carry its own name.
//   - A request that changes anything and names an Origin must name a
//     local one. A page on any site can POST here without asking (a
//     "simple" cross-origin request needs no preflight), and /api/reset
//     needs no body. A request with no Origin, such as curl or the dev
//     tools, is not a browser page and passes.
//
// listen is the -addr the server binds, so a name given there is local.
func LocalOnly(listen string, next http.Handler) http.Handler {
	own := ""
	if host, _, err := net.SplitHostPort(listen); err == nil {
		own = strings.ToLower(host)
	}
	local := func(hostport string) bool { return isLocalName(hostname(hostport), own) }
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !local(r.Host) {
			refuse(w, errs.NotLocal.New())
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" && !safeMethod(r.Method) {
			u, err := url.Parse(origin)
			if err != nil || !local(u.Host) {
				refuse(w, errs.ForeignOrigin.New())
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// refuse answers a request the server won't hear, with the catalog's words
// and nothing kept: a page on another site can ask as often as it likes.
func refuse(w http.ResponseWriter, err error) {
	v := errs.Resolve(err)
	JSON(w, v.Status, v)
}

func safeMethod(m string) bool {
	return m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions
}

// hostname is a Host or Origin host without its port or IPv6 brackets.
func hostname(hostport string) string {
	h := hostport
	if host, _, err := net.SplitHostPort(hostport); err == nil {
		h = host
	}
	return strings.ToLower(strings.Trim(h, "[]"))
}

// isLocalName is a name that can only mean this machine or a network
// address: localhost, any IP literal (a page cannot be served from one it
// does not hold), or the name the server listens on.
func isLocalName(host, own string) bool {
	switch {
	case host == "":
		return false
	case host == "localhost", strings.HasSuffix(host, ".localhost"):
		return true
	case net.ParseIP(host) != nil:
		return true
	}
	return own != "" && host == own
}

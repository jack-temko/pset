package update

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/releasesign"
	"github.com/jackt/pset/internal/testx"
)

func TestVersions(t *testing.T) {
	newer := [][2]string{{"0.2.0", "0.1.0"}, {"1.0.0", "0.9.9"}, {"0.1.1", "0.1.0"}, {"0.1.0", "0.1.0-rc.1"}, {"0.1.0-rc.2", "0.1.0-rc.1"}, {"v0.3.0", "0.2.9"}}
	for _, p := range newer {
		a, _ := parseVersion(p[0])
		b, _ := parseVersion(p[1])
		if !a.newerThan(b) || b.newerThan(a) {
			t.Errorf("%s should be newer than %s, and only that way", p[0], p[1])
		}
	}
	a, _ := parseVersion("0.1.0")
	if a.newerThan(a) {
		t.Error("a version is not newer than itself")
	}
	for _, bad := range []string{"", "1", "1.2", "1.x.3", "a.b.c", "1.2.3.4", "-1.0.0"} {
		if _, ok := parseVersion(bad); ok {
			t.Errorf("%q parsed", bad)
		}
	}
	if d, _ := parseVersion("0.1.0-dev"); !d.dev() {
		t.Error("0.1.0-dev is a source build")
	}
	if d, _ := parseVersion("0.1.0-rc.1"); d.dev() {
		t.Error("a release candidate is not a source build")
	}
}

// fixture is a fake GitHub with one release and a program installed to be replaced.
type fixture struct {
	t       *testing.T
	srv     *httptest.Server
	hits    atomic.Int32
	exe     string
	svc     *Service
	restart chan struct{}
	priv    string
	pub     string

	// What the release holds; a test changes these before it Checks.
	tag      string
	script   string // the new program
	member   string // its path in the archive
	archive  []byte // overrides the archive built from script
	sums     func(file string, archive []byte) string
	signWith string // private key to sign with; "" is the right one
	noSig    bool
}

const oldProgram = "#!/bin/sh\necho old\n"

func newFixture(t *testing.T) *fixture {
	t.Helper()
	priv, pub, err := releasesign.Generate()
	if err != nil {
		t.Fatal(err)
	}
	f := &fixture{t: t, restart: make(chan struct{}, 1), priv: priv, pub: pub, tag: "v1.1.0",
		script: "#!/bin/sh\necho \"pset 1.1.0\"\n", member: "pset-1.1.0-linux-amd64/pset"}
	f.sums = func(file string, archive []byte) string {
		h := sha256.Sum256(archive)
		return hex.EncodeToString(h[:]) + "  " + file + "\n"
	}
	dir := t.TempDir()
	f.exe = filepath.Join(dir, "pset")
	if err := os.WriteFile(f.exe, []byte(oldProgram), 0o755); err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/repos/jack-temko/pset/releases/latest", func(w http.ResponseWriter, r *http.Request) {
		f.hits.Add(1)
		if f.tag == "" {
			http.NotFound(w, r)
			return
		}
		assets := []map[string]string{{"name": "pset-1.1.0-linux-amd64.tar.gz", "browser_download_url": f.srv.URL + "/dl/pset-1.1.0-linux-amd64.tar.gz"}, {"name": "SHA256SUMS", "browser_download_url": f.srv.URL + "/dl/SHA256SUMS"}}
		if !f.noSig {
			assets = append(assets, map[string]string{"name": "SHA256SUMS.sig", "browser_download_url": f.srv.URL + "/dl/SHA256SUMS.sig"})
		}
		testx.Check(t, json.NewEncoder(w).Encode(map[string]any{"tag_name": f.tag, "body": "- a change", "published_at": "2026-10-02T00:00:00Z", "assets": assets}))
	})
	mux.HandleFunc("/dl/pset-1.1.0-linux-amd64.tar.gz", func(w http.ResponseWriter, _ *http.Request) { testx.Check(t, testx.Err(w.Write(f.tarball()))) })
	mux.HandleFunc("/dl/SHA256SUMS", func(w http.ResponseWriter, _ *http.Request) {
		testx.Check(t, testx.Err(fmt.Fprint(w, f.sums("pset-1.1.0-linux-amd64.tar.gz", f.tarballForSums()))))
	})
	mux.HandleFunc("/dl/SHA256SUMS.sig", func(w http.ResponseWriter, _ *http.Request) {
		key := f.priv
		if f.signWith != "" {
			key = f.signWith
		}
		sig, _ := releasesign.Sign(key, []byte(f.sums("pset-1.1.0-linux-amd64.tar.gz", f.tarballForSums())))
		testx.Check(t, testx.Err(fmt.Fprint(w, sig)))
	})
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	f.svc = New(Config{Version: "1.0.0", API: f.srv.URL, PublicKey: pub, GOOS: "linux", GOARCH: "amd64",
		Exe: func() (string, error) { return f.exe, nil }, Restart: func() { f.restart <- struct{}{} }})
	return f
}

func (f *fixture) tarball() []byte {
	if f.archive != nil {
		return f.archive
	}
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	testx.Check(f.t, tw.WriteHeader(&tar.Header{Name: "pset-1.1.0-linux-amd64/README.txt", Mode: 0o644, Size: 2, Typeflag: tar.TypeReg}))
	testx.Check(f.t, testx.Err(tw.Write([]byte("hi"))))
	testx.Check(f.t, tw.WriteHeader(&tar.Header{Name: f.member, Mode: 0o755, Size: int64(len(f.script)), Typeflag: tar.TypeReg}))
	testx.Check(f.t, testx.Err(tw.Write([]byte(f.script))))
	testx.Check(f.t, tw.Close())
	testx.Check(f.t, gz.Close())
	return buf.Bytes()
}

// tarballForSums is what the release's checksums are made from: the real
// archive, even when the one served has been tampered with.
func (f *fixture) tarballForSums() []byte {
	saved := f.archive
	f.archive = nil
	defer func() { f.archive = saved }()
	return f.tarball()
}

func (f *fixture) exeContent() string {
	b, _ := os.ReadFile(f.exe)
	return string(b)
}

func (f *fixture) leftovers() []string {
	entries, _ := os.ReadDir(filepath.Dir(f.exe))
	var out []string
	for _, e := range entries {
		if e.Name() != "pset" {
			out = append(out, e.Name())
		}
	}
	return out
}

func TestCheckFindsANewerReleaseAndNothingElseTalksToGitHub(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	if st := f.svc.Status(ctx); st.Checked != nil || !st.CanUpdate || st.Version != "1.0.0" {
		t.Fatalf("status before a check: %+v", st)
	}
	if f.hits.Load() != 0 {
		t.Fatal("Status contacted GitHub")
	}
	st, err := f.svc.Check(ctx)
	if err != nil || st.Checked == nil || !st.Checked.Newer || st.Checked.Version != "1.1.0" || st.Checked.Notes != "- a change" {
		t.Fatalf("check: %+v %v", st, err)
	}
	// Remembered, without asking again.
	if st := f.svc.Status(ctx); st.Checked == nil || f.hits.Load() != 1 {
		t.Fatalf("status after a check: %+v, %d hits", st, f.hits.Load())
	}
	f.tag = "v1.0.0"
	if st, _ := f.svc.Check(ctx); st.Checked.Newer {
		t.Fatal("the same version reported as newer")
	}
	f.tag = ""
	_, err = f.svc.Check(ctx)
	if v := errs.Resolve(err); v.ID != "update.no_release" || v.Status != http.StatusNotFound {
		t.Fatalf("no release at all should be said: %+v", v)
	}
}

// A build from source says why it can't update, as the one sentence Status
// carries.
func TestAFailureToCheckAndABuildFromSourceAreInTheCatalog(t *testing.T) {
	f := newFixture(t)
	f.svc.c.API = "http://127.0.0.1:1"
	_, err := f.svc.Check(context.Background())
	if v := errs.Resolve(err); v.ID != "update.check_unreachable" || v.Status != http.StatusBadGateway {
		t.Errorf("unreachable: %+v", v)
	}
	f.svc.c.Version = "dev"
	if st := f.svc.Status(context.Background()); st.CanUpdate || !strings.Contains(st.Why, "build from source") {
		t.Errorf("source build: %+v", st)
	}
}

func TestApplyReplacesTheProgramAndRestarts(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	if _, err := f.svc.Apply(ctx); err == nil {
		t.Fatal("applied without checking")
	}
	testx.Check(t, testx.Err(f.svc.Check(ctx)))
	got, err := f.svc.Apply(ctx)
	if err != nil || got.Version != "1.1.0" || !got.Restarting {
		t.Fatalf("apply: %+v %v", got, err)
	}
	if f.exeContent() != f.script {
		t.Fatalf("the program is %q", f.exeContent())
	}
	if l := f.leftovers(); len(l) != 0 {
		t.Fatalf("left files behind: %v", l)
	}
	select {
	case <-f.restart:
	case <-time.After(3 * time.Second):
		t.Fatal("PSet was not asked to restart")
	}
	// And only once.
	if _, err := f.svc.Apply(ctx); err == nil {
		t.Fatal("a second update ran while the first is restarting")
	}
}

func TestNothingIsReplacedUnlessEverythingChecksOut(t *testing.T) {
	cases := map[string]func(f *fixture){
		"a file that was changed after it was checksummed": func(f *fixture) {
			f.archive = []byte("not the archive that was signed")
		},
		"checksums signed by another key": func(f *fixture) {
			other, _, _ := releasesign.Generate()
			f.signWith = other
		},
		"a release with no signature": func(f *fixture) { f.noSig = true },
		"checksums that do not list this file": func(f *fixture) {
			f.sums = func(_ string, _ []byte) string { return strings.Repeat("a", 64) + "  other.tar.gz\n" }
		},
		"an archive without the program": func(f *fixture) { f.member = "pset-1.1.0-linux-amd64/other" },
		"a program that is not the version it says": func(f *fixture) {
			f.script = "#!/bin/sh\necho \"pset 9.9.9\"\n"
		},
		"a program that does not run": func(f *fixture) { f.script = "not a program" },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			f := newFixture(t)
			mutate(f)
			ctx := context.Background()
			if _, err := f.svc.Check(ctx); err != nil {
				t.Fatal(err)
			}
			if _, err := f.svc.Apply(ctx); err == nil {
				t.Fatal("it was applied")
			}
			if f.exeContent() != oldProgram {
				t.Fatalf("the program was changed to %q", f.exeContent())
			}
			if l := f.leftovers(); len(l) != 0 {
				t.Fatalf("left files behind: %v", l)
			}
			select {
			case <-f.restart:
				t.Fatal("it restarted")
			case <-time.After(600 * time.Millisecond):
			}
			// A failure frees it to be tried again.
			f.svc.mu.Lock()
			working := f.svc.working
			f.svc.mu.Unlock()
			if working {
				t.Fatal("still marked as updating")
			}
		})
	}
}

func TestWhyItCannotUpdate(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	for name, tweak := range map[string]func(c *Config){
		"a build from source": func(c *Config) { c.Version = "1.0.0-dev" },
		"no release key":      func(c *Config) { c.PublicKey = "" },
		"windows":             func(c *Config) { c.GOOS = "windows" },
		"a folder it cannot write": func(c *Config) {
			dir := t.TempDir()
			testx.Check(t, os.Chmod(dir, 0o500))
			t.Cleanup(func() { testx.Check(t, os.Chmod(dir, 0o700)) })
			c.Exe = func() (string, error) { return filepath.Join(dir, "pset"), nil }
		},
	} {
		c := f.svc.c
		tweak(&c)
		if name == "a folder it cannot write" && os.Geteuid() == 0 {
			continue // root can write anywhere
		}
		s := New(c)
		if st := s.Status(ctx); st.CanUpdate || st.Why == "" {
			t.Errorf("%s: %+v", name, st)
		}
		if _, err := s.Apply(ctx); err == nil {
			t.Errorf("%s: applied", name)
		}
	}
}

func TestMacsAndLinuxNameTheirFile(t *testing.T) {
	s := New(Config{Version: "0.1.0", GOOS: "darwin", GOARCH: "arm64"})
	file, member, err := s.archiveName("0.1.0")
	if err != nil || file != "pset-0.1.0-macos.tar.gz" || member != "pset-0.1.0-macos/bin/pset-arm64" {
		t.Fatalf("mac: %q %q %v", file, member, err)
	}
	s = New(Config{Version: "0.1.0", GOOS: "linux", GOARCH: "arm64"})
	if file, member, _ := s.archiveName("0.1.0"); file != "pset-0.1.0-linux-arm64.tar.gz" || member != "pset-0.1.0-linux-arm64/pset" {
		t.Fatalf("linux: %q %q", file, member)
	}
	s = New(Config{Version: "0.1.0", GOOS: "linux", GOARCH: "386"})
	if _, _, err := s.archiveName("0.1.0"); err == nil {
		t.Fatal("a 32-bit machine got a file")
	}
}

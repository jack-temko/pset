// Package update is PSet replacing itself: asking GitHub for the newest
// release when the person presses Check, and, when they press Update,
// downloading it, checking it against the release key, swapping the program
// in place and restarting. It contacts GitHub only on those two acts, and it
// believes nothing it downloads until a signature made by the release key
// over the release's checksums has been checked and the file matches them.
// Spec: ideas/release-runner-grill.md, D8 to D10.
package update

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/releasesign"
)

// Limits on what is downloaded: a program is tens of megabytes.
const (
	maxSmall   = 1 << 20
	maxProgram = 300 << 20
)

// Config is what the service is built from.
type Config struct {
	// Version is what is running.
	Version string
	// Repo is "owner/name" on GitHub.
	Repo string
	// API is GitHub's API root; tests point it elsewhere.
	API string
	// PublicKey is the release key; empty means this build cannot update.
	PublicKey string
	// Client does the downloads; nil is a plain client with a timeout.
	Client *http.Client
	// Exe is the path of the running program; nil asks the system.
	Exe func() (string, error)
	// GOOS and GOARCH pick the file; empty is this machine's.
	GOOS, GOARCH string
	// Busy counts the unfinished jobs; nil says none.
	Busy func(ctx context.Context) (int, error)
	// Restart shuts PSet down cleanly and starts the new program in its
	// place. It is called after the answer has been sent.
	Restart func()
}

// Service checks GitHub for a newer release and replaces the running program with it.
type Service struct {
	c Config

	mu      sync.Mutex
	checked *checked // the last check, with the files it found
	working bool     // an update is in progress
}

// checked is the last check: what the person is shown and where the files are.
type checked struct {
	Release
	assets map[string]string // file name to download URL
}

// New builds the service, filling in the defaults.
func New(c Config) *Service {
	if c.Repo == "" {
		c.Repo = "jack-temko/pset"
	}
	if c.API == "" {
		c.API = "https://api.github.com"
	}
	if c.Client == nil {
		c.Client = &http.Client{Timeout: 5 * time.Minute}
	}
	if c.GOOS == "" {
		c.GOOS = runtime.GOOS
	}
	if c.GOARCH == "" {
		c.GOARCH = runtime.GOARCH
	}
	if c.Exe == nil {
		c.Exe = Executable
	}
	return &Service{c: c}
}

// Executable is the running program's path with symlinks resolved, so that
// what is replaced is the file, not a link to it.
func Executable() (string, error) {
	p, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(p)
}

// Status is what is running and whether it can update; it asks nobody.
func (s *Service) Status(ctx context.Context) Status {
	st := Status{Version: s.c.Version}
	if err := s.cannot(); err != nil {
		st.Why = whyNot(err)
	}
	st.CanUpdate = st.Why == ""
	if s.c.Busy != nil {
		st.Busy, _ = s.c.Busy(ctx)
	}
	s.mu.Lock()
	if s.checked != nil {
		r := s.checked.Release
		st.Checked = &r
	}
	s.mu.Unlock()
	return st
}

// cannot says why this program cannot replace itself, or nil.
func (s *Service) cannot() error {
	v, ok := parseVersion(s.c.Version)
	switch {
	case !ok || v.dev():
		return cannotSource.New()
	case s.c.GOOS != "linux" && s.c.GOOS != "darwin":
		return cannotSystem.New()
	case s.c.PublicKey == "":
		return cannotNoKey.New()
	}
	exe, err := s.c.Exe()
	if err != nil {
		return cannotFindSelf.Wrap(err)
	}
	dir := filepath.Dir(exe)
	f, err := os.CreateTemp(dir, ".pset-write-test-*")
	if err != nil {
		return cannotWrite.Wrap(err, "dir", dir)
	}
	cleanup.Close(f)
	cleanup.Remove(f.Name())
	return nil
}

// whyNot is a cannot reason as the one sentence Status carries.
func whyNot(err error) string {
	v := errs.Resolve(err)
	return v.Why + " " + v.Fix
}

// Check asks GitHub for the newest published release (a prerelease is not
// one). It is the only time PSet contacts GitHub besides an update.
func (s *Service) Check(ctx context.Context) (Status, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("%s/repos/%s/releases/latest", s.c.API, s.c.Repo), nil)
	if err != nil {
		return Status{}, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "pset/"+s.c.Version)
	resp, err := s.c.Client.Do(req)
	if err != nil {
		return Status{}, checkUnreachable.Wrap(err)
	}
	defer cleanup.Close(resp.Body)
	if resp.StatusCode == http.StatusNotFound {
		return Status{}, noRelease.New()
	}
	if resp.StatusCode != http.StatusOK {
		return Status{}, githubError.New("status", strconv.Itoa(resp.StatusCode))
	}
	var rel struct {
		Tag       string `json:"tag_name"`
		Body      string `json:"body"`
		Published string `json:"published_at"`
		Assets    []struct {
			Name string `json:"name"`
			URL  string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxSmall)).Decode(&rel); err != nil {
		return Status{}, unreadableRelease.Wrap(err)
	}
	latest, ok := parseVersion(rel.Tag)
	if !ok {
		return Status{}, badTag.New("tag", strconv.Quote(rel.Tag))
	}
	cur, _ := parseVersion(s.c.Version)
	c := &checked{
		Release: Release{
			Version:   strings.TrimPrefix(rel.Tag, "v"),
			Notes:     rel.Body,
			Published: rel.Published,
			Newer:     latest.newerThan(cur),
		},
		assets: map[string]string{},
	}
	for _, a := range rel.Assets {
		c.assets[a.Name] = a.URL
	}
	s.mu.Lock()
	s.checked = c
	s.mu.Unlock()
	return s.Status(ctx), nil
}

// Apply installs the release the last check found: it fetches the checksums
// and their signature, checks the signature against the release key, fetches
// this machine's file, checks it against the signed checksums, takes the
// program out of it, runs it once to see it is the version it should be, then
// swaps it over the running one. It restarts PSet after the answer is sent.
func (s *Service) Apply(ctx context.Context) (Applied, error) {
	if err := s.cannot(); err != nil {
		return Applied{}, err
	}
	s.mu.Lock()
	c := s.checked
	if c == nil || !c.Newer {
		s.mu.Unlock()
		return Applied{}, nothingToInstall.New()
	}
	if s.working {
		s.mu.Unlock()
		return Applied{}, alreadyInstalling.New()
	}
	s.working = true
	s.mu.Unlock()
	done := false
	defer func() {
		if !done {
			s.mu.Lock()
			s.working = false
			s.mu.Unlock()
		}
	}()

	exe, err := s.c.Exe()
	if err != nil {
		return Applied{}, err
	}
	next, err := s.fetch(ctx, c, filepath.Dir(exe))
	if err != nil {
		// What fetch names is already explained; anything else is the disk.
		var named *errs.Error
		if !errors.As(err, &named) {
			err = replaceFailed.Wrap(err)
		}
		return Applied{}, err
	}
	if err := os.Rename(next, exe); err != nil {
		cleanup.Remove(next)
		return Applied{}, replaceFailed.Wrap(err)
	}
	done = true
	if s.c.Restart != nil {
		// After the answer is out: the page is waiting for it.
		go func() {
			time.Sleep(400 * time.Millisecond)
			s.c.Restart()
		}()
	}
	return Applied{Version: c.Version, Restarting: true}, nil
}

// archiveName is the release file for this machine, and the path of the
// program inside it.
func (s *Service) archiveName(v string) (file, member string, err error) {
	switch s.c.GOOS {
	case "linux":
		if s.c.GOARCH != "amd64" && s.c.GOARCH != "arm64" {
			return "", "", notForThisComputer.New()
		}
		dir := fmt.Sprintf("pset-%s-linux-%s", v, s.c.GOARCH)
		return dir + ".tar.gz", dir + "/pset", nil
	case "darwin":
		if s.c.GOARCH != "amd64" && s.c.GOARCH != "arm64" {
			return "", "", notForThisComputer.New()
		}
		dir := fmt.Sprintf("pset-%s-macos", v)
		return dir + ".tar.gz", dir + "/bin/pset-" + s.c.GOARCH, nil
	}
	return "", "", notForThisComputer.New()
}

// fetch downloads and verifies this machine's program and leaves it, ready to
// be renamed into place, in dir (the same folder, so the rename is atomic).
func (s *Service) fetch(ctx context.Context, c *checked, dir string) (string, error) {
	file, member, err := s.archiveName(c.Version)
	if err != nil {
		return "", err
	}
	sumsURL, sigURL, fileURL := c.assets["SHA256SUMS"], c.assets["SHA256SUMS.sig"], c.assets[file]
	if sumsURL == "" || sigURL == "" {
		return "", notTrusted.Wrap(errors.New("this release has no signed checksums"))
	}
	if fileURL == "" {
		return "", notForThisComputer.Wrap(fmt.Errorf("this release has no file %s", file))
	}
	sums, err := s.get(ctx, sumsURL, maxSmall)
	if err != nil {
		return "", err
	}
	sig, err := s.get(ctx, sigURL, maxSmall)
	if err != nil {
		return "", err
	}
	if err := releasesign.Verify(s.c.PublicKey, sums, string(sig)); err != nil {
		return "", notTrusted.Wrap(fmt.Errorf("the release's checksums fail their signature check: %w", err))
	}
	entries, err := releasesign.ParseSums(string(sums))
	if err != nil {
		return "", notTrusted.Wrap(err)
	}
	want := ""
	for _, e := range entries {
		if e.File == file {
			want = e.Sum
		}
	}
	if want == "" {
		return "", notTrusted.Wrap(fmt.Errorf("the signed checksums don't list %s", file))
	}

	tmp, err := os.CreateTemp(dir, ".pset-update-*.tar.gz")
	if err != nil {
		return "", err
	}
	defer cleanup.Remove(tmp.Name())
	h := sha256.New()
	if err := s.copyTo(ctx, fileURL, io.MultiWriter(tmp, h), maxProgram); err != nil {
		cleanup.Close(tmp)
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	if got := hex.EncodeToString(h.Sum(nil)); got != want {
		return "", notTrusted.Wrap(errors.New("the download doesn't match its signed checksum"))
	}

	out, err := os.CreateTemp(dir, ".pset-new-*")
	if err != nil {
		return "", err
	}
	if err := extractMember(tmp.Name(), member, out); err != nil {
		cleanup.Close(out)
		cleanup.Remove(out.Name())
		return "", err
	}
	if err := out.Close(); err != nil {
		cleanup.Remove(out.Name())
		return "", err
	}
	if err := os.Chmod(out.Name(), 0o755); err != nil {
		cleanup.Remove(out.Name())
		return "", err
	}
	// It runs once to say what it is: the wrong build for this machine, or one
	// built as another version, is caught before it replaces anything.
	vctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	got, err := exec.CommandContext(vctx, out.Name(), "-version").Output()
	if want := "pset " + c.Version; err != nil || strings.TrimSpace(string(got)) != want {
		cleanup.Remove(out.Name())
		return "", notForThisComputer.Wrap(fmt.Errorf("the new program doesn't run here as %q", want))
	}
	return out.Name(), nil
}

func (s *Service) get(ctx context.Context, url string, limit int64) ([]byte, error) {
	var b strings.Builder
	if err := s.copyTo(ctx, url, &b, limit); err != nil {
		return nil, err
	}
	return []byte(b.String()), nil
}

// copyTo downloads a URL into w, refusing anything bigger than limit.
func (s *Service) copyTo(ctx context.Context, url string, w io.Writer, limit int64) error {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "pset/"+s.c.Version)
	resp, err := s.c.Client.Do(req)
	if err != nil {
		return downloadFailed.Wrap(err)
	}
	defer cleanup.Close(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return downloadFailed.Wrap(fmt.Errorf("a download answered %d", resp.StatusCode))
	}
	n, err := io.Copy(w, io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return downloadFailed.Wrap(err)
	}
	if n > limit {
		return notTrusted.Wrap(errors.New("a download was bigger than any release should be"))
	}
	return nil
}

// extractMember writes one file of a .tar.gz to w. The member is named in
// full, so nothing else in the archive is read or written.
func extractMember(archive, member string, w io.Writer) error {
	f, err := os.Open(archive)
	if err != nil {
		return err
	}
	defer cleanup.Close(f)
	gz, err := gzip.NewReader(f)
	if err != nil {
		return notTrusted.Wrap(errors.New("the download isn't a release archive"))
	}
	tr := tar.NewReader(gz)
	for {
		h, err := tr.Next()
		if err == io.EOF {
			return notTrusted.Wrap(fmt.Errorf("the download has no %s in it", member))
		}
		if err != nil {
			return notTrusted.Wrap(errors.New("the download isn't a release archive"))
		}
		if h.Typeflag == tar.TypeReg && h.Name == member {
			if _, err := io.Copy(w, io.LimitReader(tr, maxProgram+1)); err != nil {
				return err
			}
			return nil
		}
	}
}

// Routes mounts the update endpoints.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/update", httpx.Reply(func(r *http.Request) (Status, error) {
		return s.Status(r.Context()), nil
	}))
	mux.HandleFunc("POST /api/update/check", httpx.Reply(func(r *http.Request) (Status, error) {
		return s.Check(r.Context())
	}))
	mux.HandleFunc("POST /api/update/apply", httpx.Reply(func(r *http.Request) (Applied, error) {
		return s.Apply(r.Context())
	}))
}

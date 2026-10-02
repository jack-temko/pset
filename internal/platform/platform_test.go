package platform

import (
	"path/filepath"
	"strings"
	"testing"
)

func env(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

func TestDetect(t *testing.T) {
	cases := []struct {
		name string
		goos string
		env  map[string]string
		proc string
		want Kind
	}{
		{"mac", "darwin", nil, "", Mac},
		{"plain linux", "linux", nil, "Linux version 6.8.0-generic (buildd@ubuntu)", Linux},
		{"wsl by name", "linux", map[string]string{"WSL_DISTRO_NAME": "Ubuntu"}, "", WSL},
		{"wsl by interop", "linux", map[string]string{"WSL_INTEROP": "/run/WSL/1_interop"}, "", WSL},
		{"wsl by kernel", "linux", nil, "Linux version 6.18.40.1-microsoft-standard-WSL2", WSL},
		{"windows", "windows", nil, "", Other},
	}
	for _, c := range cases {
		if got := detect(c.goos, env(c.env), c.proc); got != c.want {
			t.Errorf("%s: %v, want %v", c.name, got, c.want)
		}
	}
}

func TestDataDir(t *testing.T) {
	if got := DataDir(Mac, "/Users/a", ""); got != filepath.Join("/Users/a", "Library", "Application Support", "pset") {
		t.Errorf("mac: %s", got)
	}
	// A Mac ignores XDG: it is the system's place or nothing.
	if got := DataDir(Mac, "/Users/a", "/x"); !strings.HasSuffix(got, "Application Support/pset") {
		t.Errorf("mac with XDG: %s", got)
	}
	if got := DataDir(Linux, "/home/a", ""); got != "/home/a/.local/share/pset" {
		t.Errorf("linux: %s", got)
	}
	if got := DataDir(WSL, "/home/a", "/data"); got != "/data/pset" {
		t.Errorf("wsl with XDG: %s", got)
	}
	if OldMacDataDir("/Users/a") != "/Users/a/.local/share/pset" {
		t.Error("old mac dir")
	}
}

func TestOpenCommand(t *testing.T) {
	has := func(names ...string) func(string) bool {
		return func(n string) bool {
			for _, x := range names {
				if x == n {
					return true
				}
			}
			return false
		}
	}
	u := "http://127.0.0.1:8420"
	cases := []struct {
		name string
		k    Kind
		have func(string) bool
		want string
		ok   bool
	}{
		{"mac", Mac, has(), "open", true},
		{"linux", Linux, has("xdg-open"), "xdg-open", true},
		{"linux without a way", Linux, has(), "", false},
		{"wsl prefers wslview", WSL, has("wslview", "explorer.exe", "xdg-open"), "wslview", true},
		{"wsl falls back to explorer", WSL, has("explorer.exe", "xdg-open"), "explorer.exe", true},
		{"wsl with only xdg-open", WSL, has("xdg-open"), "xdg-open", true},
		{"wsl with nothing", WSL, has(), "", false},
		{"other", Other, has("xdg-open"), "", false},
	}
	for _, c := range cases {
		got, ok := OpenCommand(c.k, u, c.have)
		if ok != c.ok || got.Name != c.want {
			t.Errorf("%s: %q %v, want %q %v", c.name, got.Name, ok, c.want, c.ok)
		}
		if ok && (len(got.Args) != 1 || got.Args[0] != u) {
			t.Errorf("%s: args %v", c.name, got.Args)
		}
	}
}

func TestBrowserURL(t *testing.T) {
	for in, want := range map[string]string{
		"127.0.0.1:8420": "http://127.0.0.1:8420",
		"localhost:9000": "http://localhost:9000",
		"0.0.0.0:8420":   "http://127.0.0.1:8420",
		":8420":          "http://127.0.0.1:8420",
	} {
		if got := BrowserURL(in); got != want {
			t.Errorf("%s: %s, want %s", in, got, want)
		}
	}
}

func TestHints(t *testing.T) {
	if got := InstallHint(Mac, "poppler-utils", "poppler"); got != "brew install poppler" {
		t.Error(got)
	}
	for _, k := range []Kind{Linux, WSL} {
		if got := InstallHint(k, "poppler-utils", "poppler"); got != "sudo apt install poppler-utils" {
			t.Error(got)
		}
	}
	if !strings.Contains(OllamaHint(WSL), "systemd") || strings.Contains(OllamaHint(Linux), "systemd") {
		t.Error("only the WSL hint talks about systemd")
	}
	if !strings.Contains(OllamaHint(Mac), "brew") {
		t.Error("mac hint")
	}
}

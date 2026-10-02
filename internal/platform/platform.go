// Package platform is what differs between the machines PSet runs on:
// macOS, plain Linux and Linux under WSL (Windows is not supported yet).
// Where its data lives by default, how it opens a browser, and what to tell
// someone who is missing a tool. Everything that varies is a function of a
// Kind, so it can be tested without being on that machine.
package platform

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// Kind is the sort of machine.
type Kind int

const (
	// Linux is any Linux that is not WSL.
	Linux Kind = iota
	// WSL is Linux inside the Windows Subsystem for Linux.
	WSL
	// Mac is macOS.
	Mac
	// Other is anything PSet is not built for.
	Other
)

func (k Kind) String() string {
	return [...]string{"Linux", "WSL", "macOS", "this system"}[k]
}

// Current is the machine PSet is on, found once; tests set it.
var Current = Detect()

// Detect finds the kind of machine from the system.
func Detect() Kind {
	var proc string
	if b, err := os.ReadFile("/proc/version"); err == nil {
		proc = string(b)
	}
	return detect(runtime.GOOS, os.Getenv, proc)
}

// detect is Detect from its inputs: the OS name, the environment and the
// text of /proc/version. WSL names itself in the environment and in the
// kernel's version string ("...-microsoft-standard-WSL2").
func detect(goos string, env func(string) string, procVersion string) Kind {
	switch goos {
	case "darwin":
		return Mac
	case "linux":
		if env("WSL_DISTRO_NAME") != "" || env("WSL_INTEROP") != "" ||
			strings.Contains(strings.ToLower(procVersion), "microsoft") {
			return WSL
		}
		return Linux
	}
	return Other
}

// DataDir is where the library lives when nothing says otherwise. On a Mac
// it is the system's own place for an app's files; elsewhere it follows the
// XDG convention, and a Mac user's old data in the XDG place is not moved
// (it is left where it is).
func DataDir(k Kind, home, xdgDataHome string) string {
	if k == Mac {
		return filepath.Join(home, "Library", "Application Support", "pset")
	}
	if xdgDataHome == "" {
		xdgDataHome = filepath.Join(home, ".local", "share")
	}
	return filepath.Join(xdgDataHome, "pset")
}

// OldMacDataDir is where a Mac's data was before it moved to the system's
// place, for saying so when it is found there and the new place is empty.
func OldMacDataDir(home string) string {
	return filepath.Join(home, ".local", "share", "pset")
}

// Command is a program and its arguments.
type Command struct {
	Name string
	Args []string
}

// OpenCommand is how to open a URL in the person's browser on this kind of
// machine, or false when there is no way. `have` says whether a program is
// installed. Under WSL the browser is Windows's: wslview when it is there,
// else Windows's own explorer.exe, which hands the URL to the default browser.
func OpenCommand(k Kind, url string, have func(string) bool) (Command, bool) {
	switch k {
	case Mac:
		return Command{"open", []string{url}}, true
	case WSL:
		if have("wslview") {
			return Command{"wslview", []string{url}}, true
		}
		if have("explorer.exe") {
			return Command{"explorer.exe", []string{url}}, true
		}
		fallthrough
	case Linux:
		if have("xdg-open") {
			return Command{"xdg-open", []string{url}}, true
		}
	}
	return Command{}, false
}

// OpenBrowser opens a URL in the default browser, without waiting for it.
// explorer.exe exits non-zero even when it worked, so the exit status is
// not an answer; only failing to start is.
func OpenBrowser(url string) error {
	c, ok := OpenCommand(Current, url, func(name string) bool {
		_, err := exec.LookPath(name)
		return err == nil
	})
	if !ok {
		return exec.ErrNotFound
	}
	cmd := exec.Command(c.Name, c.Args...)
	if err := cmd.Start(); err != nil {
		return err
	}
	go cmd.Wait()
	return nil
}

// BrowserURL is the address to open for a listen address: a wildcard host
// is opened as localhost.
func BrowserURL(addr string) string {
	host, port := addr, ""
	if i := strings.LastIndex(addr, ":"); i >= 0 {
		host, port = addr[:i], addr[i:]
	}
	switch host {
	case "", "0.0.0.0", "[::]", "::":
		host = "127.0.0.1"
	}
	return "http://" + host + port
}

// InstallHint is the command that installs a package here: apt's name on
// Linux and WSL (Debian and Ubuntu), Homebrew's on a Mac.
func InstallHint(k Kind, apt, brew string) string {
	if k == Mac {
		return "brew install " + brew
	}
	return "sudo apt install " + apt
}

// OllamaHint says how to get Ollama running here, for the Health page.
func OllamaHint(k Kind) string {
	switch k {
	case Mac:
		return "Install it with `brew install ollama`, then start it with `brew services start ollama`"
	case WSL:
		return "Install it inside WSL with `curl -fsSL https://ollama.com/install.sh | sh`. WSL needs systemd for it to start by itself (add `[boot]` and `systemd=true` to /etc/wsl.conf, then `wsl --shutdown` from Windows), or run `ollama serve` in another terminal"
	}
	return "Install it with `curl -fsSL https://ollama.com/install.sh | sh` and start it with `ollama serve`"
}

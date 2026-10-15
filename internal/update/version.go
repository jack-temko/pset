package update

import (
	"strconv"
	"strings"
)

// version is a release number: MAJOR.MINOR.PATCH, with an optional
// -prerelease.
type version struct {
	major, minor, patch int
	pre                 string
}

// parseVersion reads "0.2.1", "v0.2.1" or "0.2.1-rc.1". A build from source
// ("0.1.0-dev") parses too; dev says so.
func parseVersion(s string) (version, bool) {
	s = strings.TrimPrefix(strings.TrimSpace(s), "v")
	core, pre, _ := strings.Cut(s, "-")
	parts := strings.Split(core, ".")
	if len(parts) != 3 {
		return version{}, false
	}
	var n [3]int
	for i, p := range parts {
		v, err := strconv.Atoi(p)
		if err != nil || v < 0 {
			return version{}, false
		}
		n[i] = v
	}
	return version{n[0], n[1], n[2], pre}, true
}

// dev is a build from source, which cannot update itself.
func (v version) dev() bool { return v.pre == "dev" || strings.HasPrefix(v.pre, "dev.") }

// newerThan is whether v comes after o. A release comes after its own
// prereleases, as in semver; prereleases are only compared by name.
func (v version) newerThan(o version) bool {
	for _, p := range [][2]int{{v.major, o.major}, {v.minor, o.minor}, {v.patch, o.patch}} {
		if p[0] != p[1] {
			return p[0] > p[1]
		}
	}
	switch {
	case v.pre == o.pre:
		return false
	case v.pre == "":
		return true
	case o.pre == "":
		return false
	}
	return v.pre > o.pre
}

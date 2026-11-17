// Package backend assembles the new backend's features on the store, each
// declaring its actions in the one catalog: main serves it, the catalog's
// test walks it, and tools/actioncatalog generates it to TypeScript.
package backend

import (
	"net/http"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/course"
	"github.com/jackt/pset/internal/incident"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/store"
)

// Backend is the features and their catalog.
type Backend struct {
	Actions   *action.Catalog
	Courses   *course.Service
	Incidents *incident.Service
}

// New builds every feature on s, with r running the background work. With a
// nil store and runner it is the catalog alone, for generating it: nothing
// runs.
func New(s *store.Store, r *runner.Runner) *Backend {
	c := action.New(s)
	return &Backend{Actions: c, Courses: course.New(s, c), Incidents: incident.New(s, c, r)}
}

// Routes mounts the catalog's routes and every feature's reads.
func (b *Backend) Routes(mux *http.ServeMux) {
	b.Actions.Routes(mux)
	b.Courses.Routes(mux)
	b.Incidents.Routes(mux)
}

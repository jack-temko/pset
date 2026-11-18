// Package backend assembles the new backend's features on the store, each
// declaring its actions in the one catalog: main serves it, the catalog's
// test walks it, and tools/actioncatalog generates it to TypeScript.
package backend

import (
	"context"
	"net/http"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/course"
	"github.com/jackt/pset/internal/incident"
	"github.com/jackt/pset/internal/library"
	"github.com/jackt/pset/internal/material"
	"github.com/jackt/pset/internal/place"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/store"
)

// Options are what the features need beyond the store.
type Options struct {
	// Runner runs the background work; nil to declare the catalog alone.
	Runner  *runner.Runner
	DataDir string
	// Tools read PDFs; empty is the live ones.
	Tools library.Tools
	// ChatModel is the model a material's naming and contents ask.
	ChatModel string
	// Embed makes search's vectors in EmbedModel's space; nil for words
	// alone.
	Embed      func(ctx context.Context, texts []string) ([][]float32, error)
	EmbedModel string
}

// Backend is the features and their catalog.
type Backend struct {
	Actions   *action.Catalog
	Courses   *course.Service
	Materials *material.Service
	Incidents *incident.Service
	Places    *place.Service
}

// New builds every feature on s. With a nil store and no runner it is the
// catalog alone, for generating it: nothing runs.
func New(s *store.Store, o Options) *Backend {
	c := action.New(s)
	return &Backend{
		Actions: c,
		Courses: course.New(s, c),
		Materials: material.New(material.Config{
			Store: s, Actions: c, Runner: o.Runner, DataDir: o.DataDir, Tools: o.Tools,
			ChatModel: o.ChatModel, Embed: o.Embed, EmbedModel: o.EmbedModel,
		}),
		Incidents: incident.New(s, c, o.Runner),
		Places:    place.New(s),
	}
}

// Routes mounts the catalog's routes and every feature's reads.
func (b *Backend) Routes(mux *http.ServeMux) {
	b.Actions.Routes(mux)
	b.Courses.Routes(mux)
	b.Materials.Routes(mux)
	b.Incidents.Routes(mux)
	b.Places.Routes(mux)
}

package engine

import (
	"context"

	"github.com/jackt/pset/internal/store"
)

// taskKind is a kind's shape: the phases it plans at claim, plus optional
// settle logic for domain side effects that must run whatever the outcome.
type taskKind struct {
	plan   func(ctx context.Context, p *pipeline) ([]PhaseSpec, error)
	settle func(ctx context.Context, p *pipeline, err error) error
}

// taskKinds is the whole registry. Preparing a book, reading an assignment,
// and working one of its questions; OCR, indexing and embedding are phases
// of preparation, never tasks of their own.
var taskKinds = map[string]taskKind{
	store.TaskPrepare: {
		plan: func(ctx context.Context, p *pipeline) ([]PhaseSpec, error) {
			return p.preparePlan(ctx)
		},
	},
	store.TaskHomework: {
		plan: func(ctx context.Context, p *pipeline) ([]PhaseSpec, error) {
			return p.homeworkPlan(ctx)
		},
		settle: func(ctx context.Context, p *pipeline, err error) error {
			return p.homeworkSettle(ctx, err)
		},
	},
	store.TaskQuestion: {
		plan: func(ctx context.Context, p *pipeline) ([]PhaseSpec, error) {
			return p.questionPlan(ctx)
		},
		settle: func(ctx context.Context, p *pipeline, err error) error {
			return p.questionSettle(ctx, err)
		},
	},
}

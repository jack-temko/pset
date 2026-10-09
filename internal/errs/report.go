package errs

import (
	"context"
	"crypto/rand"
	"log/slog"
	"sync/atomic"
	"time"
)

// Where says where an error happened, for the errors list and the log. It
// holds ids and names, never a key, a prompt or an answer.
type Where struct {
	// Route is "GET /api/books/{id}" for a request, or a job's name.
	Route string
	// Book, Set and Question are the ids the failure was about, when known.
	Book, Set, Question string
}

// Record is one kept error.
type Record struct {
	Incident string
	View     View
	// Detail is the chain's full Go error text.
	Detail string
	Where  Where
	At     time.Time
}

// Recorder keeps errors where the student can list them. The errlog package
// is the one implementation.
type Recorder interface {
	Record(ctx context.Context, r Record) error
}

var recorder atomic.Pointer[Recorder]

// SetRecorder sets where Report keeps errors. Called once at start-up; nil
// keeps none.
func SetRecorder(r Recorder) {
	if r == nil {
		recorder.Store(nil)
		return
	}
	recorder.Store(&r)
}

// crockford is base32 without I, L, O and U, which are easy to misread.
const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// NewIncident is a fresh six-character incident id.
func NewIncident() string {
	var b [6]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic("errs: no randomness: " + err.Error())
	}
	for i := range b {
		b[i] = crockford[int(b[i])%len(crockford)]
	}
	return string(b[:])
}

// Report resolves err, gives it an incident id, writes one structured log
// line with the whole chain and every Go error text, keeps it through the
// recorder, and returns the view. A field error is the student's typing, not
// a failure: it is resolved and returned, with no incident and no record.
func Report(ctx context.Context, err error, where Where) View {
	v := Resolve(err)
	if v.Scope == ScopeField {
		return v
	}
	v.Incident = NewIncident()
	detail := err.Error()
	level := slog.LevelWarn
	if v.Status >= 500 {
		level = slog.LevelError
	}
	slog.Log(ctx, level, "error",
		"incident", v.Incident,
		"id", v.ID,
		"chain", v.Chain,
		"where", where.Route,
		"book", where.Book,
		"set", where.Set,
		"question", where.Question,
		"detail", detail,
	)
	if r := recorder.Load(); r != nil {
		rec := Record{Incident: v.Incident, View: v, Detail: detail, Where: where, At: time.Now().UTC()}
		if rerr := (*r).Record(ctx, rec); rerr != nil {
			slog.Warn("keep error", "incident", v.Incident, "err", rerr)
		}
	}
	return v
}

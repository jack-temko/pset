package activity

import "github.com/jackt/pset/internal/errs"

var (
	unknownKind = errs.Define(errs.Entry{
		ID:    "activity.unknown_kind",
		What:  "There's no activity called {kind}.",
		Scope: errs.ScopeField,
	})
	badID = errs.Define(errs.Entry{
		ID:    "activity.bad_id",
		What:  "Name the stretch with an id of up to 64 characters.",
		Scope: errs.ScopeField,
	})
	badQuestionID = errs.Define(errs.Entry{
		ID:    "activity.bad_question_id",
		What:  "A question's id is up to 64 characters.",
		Scope: errs.ScopeField,
	})
	notHomework = errs.Define(errs.Entry{
		ID:    "activity.not_homework",
		What:  "Only homework time is for a question.",
		Scope: errs.ScopeField,
	})
	badTimes = errs.Define(errs.Entry{
		ID:    "activity.bad_times",
		What:  "Say when the stretch started and ended, as RFC 3339 times.",
		Scope: errs.ScopeField,
	})
	badSince = errs.Define(errs.Entry{
		ID:    "activity.bad_since",
		What:  "Say when the week starts, as an RFC 3339 time.",
		Scope: errs.ScopeField,
	})
)

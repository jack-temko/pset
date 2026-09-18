package engine

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackt/pset/internal/store"
)

// Repairs are direct requests, not tasks. The task system owns work that is
// long, resumable, and object-building; a walkthrough rewrite is one model
// call, and queueing it behind a forty-minute book would make it wait an
// hour. It runs now, on the question it belongs to, and the write lands even
// if the student navigates away mid-call.

// QuestionAdjust carries the hand corrections of the Adjust panel: a page,
// a reframed region, reframed figures, or a question that turns out not to
// come from the book at all. Everything here is direct manipulation — no
// model call, no prose. Anything said in words goes through the tutor chat.
type QuestionAdjust struct {
	Page         *int
	QuestionRect *store.HomeworkRect
	Diagrams     []store.HomeworkDiagram
	Standalone   *bool
}

// AdjustQuestion applies hand corrections and saves them immediately. Moving
// the page is the one change that invalidates the walkthrough: it means this
// was the wrong problem, so what was written about it no longer applies.
func (e *Engine) AdjustQuestion(ctx context.Context, questionID string, in QuestionAdjust) (*store.HomeworkQuestion, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	q, err := s.QuestionByID(ctx, questionID)
	if err != nil {
		return nil, err
	}
	book, err := e.questionBook(ctx, s, q)
	if err != nil {
		return nil, err
	}

	moved := false
	if in.Page != nil {
		if *in.Page < 1 || *in.Page > book.PageCount {
			return nil, &UserError{Message: fmt.Sprintf(
				"%q has %d pages, so there is no page %d", book.Title, book.PageCount, *in.Page)}
		}
		if q.Page == nil || *q.Page != *in.Page {
			moved = true
		}
		q.Page = in.Page
	}
	if in.QuestionRect != nil {
		if !in.QuestionRect.Valid() {
			return nil, &UserError{Message: "that region is off the page"}
		}
		q.QuestionRect = in.QuestionRect
	}
	if in.Diagrams != nil {
		for _, d := range in.Diagrams {
			if !d.Rect.Valid() {
				return nil, &UserError{Message: "one of those figure regions is off the page"}
			}
		}
		q.Diagrams = in.Diagrams
	}
	if in.Standalone != nil && *in.Standalone != q.Standalone {
		q.Standalone = *in.Standalone
		moved = true
		if q.Standalone {
			q.Page, q.QuestionRect, q.Diagrams = nil, nil, nil
		}
	}

	if moved && q.Guide != nil {
		q.Status = store.QuestionStale
	}
	q.Error = ""
	if err := s.UpdateQuestionContent(ctx, q); err != nil {
		return nil, userf(err, "could not save that adjustment")
	}
	if moved && q.Page != nil {
		// A correction by hand is the strongest signal there is about where
		// this book keeps things.
		e.learnFromLocation(ctx, s, book, q)
	}
	return q, nil
}

// EditQuestionText replaces a question's transcription. It invalidates the
// walkthrough but not the location: correcting a garbled transcription does
// not change which problem it is.
func (e *Engine) EditQuestionText(ctx context.Context, questionID, text string) (*store.HomeworkQuestion, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, &UserError{Message: "the question text is empty"}
	}
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	q, err := s.QuestionByID(ctx, questionID)
	if err != nil {
		return nil, err
	}
	if q.Transcription == text {
		return q, nil
	}
	q.Transcription = text
	q.Error = ""
	if q.Guide != nil {
		q.Status = store.QuestionStale
	}
	if err := s.UpdateQuestionContent(ctx, q); err != nil {
		return nil, userf(err, "could not save that edit")
	}
	return q, nil
}

// AddUnderstandingNote pins one durable correction on a question: the note
// feeds every later walkthrough rewrite and never prints on the sheet. A
// question with a walkthrough goes stale — the card says so and offers the
// rewrite that consumes the notes.
func (e *Engine) AddUnderstandingNote(ctx context.Context, questionID, note string) (*store.HomeworkQuestion, error) {
	note = strings.TrimSpace(note)
	if note == "" {
		return nil, &UserError{Message: "the note is empty"}
	}
	if len(note) > chatMaxNoteChars {
		return nil, &UserError{Message: fmt.Sprintf("notes are capped at %d characters", chatMaxNoteChars)}
	}
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	q, err := s.QuestionByID(ctx, questionID)
	if err != nil {
		return nil, err
	}
	q.UnderstandingNotes = append(q.UnderstandingNotes, store.UnderstandingNote{Note: note, At: time.Now().UTC()})
	if q.Guide != nil {
		q.Status = store.QuestionStale
	}
	q.Error = ""
	if err := s.UpdateQuestionContent(ctx, q); err != nil {
		return nil, userf(err, "could not save that note")
	}
	return q, nil
}

// RelocateQuestion queues finding a question in the book again. A page the
// student names turns the hard problem — search the whole book — into the
// easy one: find the region on this page. A note in words is carried into
// the search.
//
// The walkthrough is rewritten afterwards, because it was written about
// whatever was found before — so this is the full pass, both phases.
//
// It is a task, not a direct call: locating and writing take minutes
// between them, and a minutes-long request that dies with the page that
// started it is how a rewrite used to get lost. As a task it survives a
// closed tab and a restarted server, and it can be stopped and retried.
func (e *Engine) RelocateQuestion(ctx context.Context, questionID string, page *int, note string) (*store.Task, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	q, err := s.QuestionByID(ctx, questionID)
	if err != nil {
		return nil, err
	}
	book, err := e.questionBook(ctx, s, q)
	if err != nil {
		return nil, err
	}
	if page != nil && (*page < 1 || *page > book.PageCount) {
		return nil, &UserError{Message: fmt.Sprintf(
			"%q has %d pages, so there is no page %d", book.Title, book.PageCount, *page)}
	}
	return e.enqueueQuestion(ctx, s, q.ID, questionParams{
		Mode: QuestionFull, Page: page, Note: strings.TrimSpace(note),
	})
}

// RewriteQuestion queues one walkthrough being written again, from the
// location it already has; the question's understanding notes ride along
// (see guideUserText). Nothing else in the assignment is touched.
func (e *Engine) RewriteQuestion(ctx context.Context, questionID, note string) (*store.Task, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	q, err := s.QuestionByID(ctx, questionID)
	if err != nil {
		return nil, err
	}
	if !q.Standalone && q.Page == nil {
		return nil, &UserError{Message: "this question has no place in the book yet — find it first"}
	}
	return e.enqueueQuestion(ctx, s, q.ID, questionParams{
		Mode: QuestionGuide, Instruction: strings.TrimSpace(note),
	})
}

// failQuestion records a repair failure on the question's own row, so the
// card can say what went wrong next to the thing that went wrong.
func (e *Engine) failQuestion(ctx context.Context, s *store.Store, q *store.HomeworkQuestion, err error) {
	q.Status = store.QuestionFailed
	q.Error = userSentence(err)
	if uerr := s.UpdateQuestionContent(context.WithoutCancel(ctx), q); uerr != nil {
		e.logger.Error("persist question failure", "question", q.ID, "err", uerr)
	}
}

// questionBook loads the book an assignment draws from.
func (e *Engine) questionBook(ctx context.Context, s *store.Store, q *store.HomeworkQuestion) (*store.Book, error) {
	hw, err := s.HomeworkByID(ctx, q.HomeworkID)
	if err != nil {
		return nil, err
	}
	book, err := s.BookByID(ctx, hw.BookID)
	if errors.Is(err, store.ErrNotFound) {
		return nil, &UserError{Message: "this assignment's book is gone"}
	}
	if err != nil {
		return nil, err
	}
	return book, nil
}

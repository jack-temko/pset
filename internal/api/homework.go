package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackt/pset/internal/engine"
	"github.com/jackt/pset/internal/store"
)

// --- wire forms -----------------------------------------------------------------

type homeworkJSON struct {
	ID            string    `json:"id"`
	BookID        string    `json:"bookId"`
	BookSHA256    string    `json:"bookSha256"`
	BookTitle     string    `json:"bookTitle"`
	Title         string    `json:"title"`
	DueDate       *string   `json:"dueDate"`
	Status        string    `json:"status"`
	TurnedIn      bool      `json:"turnedIn"`
	QuestionCount int       `json:"questionCount"`
	QuestionScale int       `json:"questionScale"`
	FigureScale   int       `json:"figureScale"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func homeworkJSONFromRef(r *store.HomeworkRef) homeworkJSON {
	return homeworkJSON{
		ID:            r.ID,
		BookID:        r.BookID,
		BookSHA256:    r.BookSHA256,
		BookTitle:     r.BookTitle,
		Title:         r.Title,
		DueDate:       r.DueDate,
		Status:        r.Status,
		TurnedIn:      r.TurnedIn,
		QuestionCount: r.QuestionCount,
		QuestionScale: r.QuestionScale,
		FigureScale:   r.FigureScale,
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}

type homeworkRectJSON struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	W float64 `json:"w"`
	H float64 `json:"h"`
}

type homeworkDiagramJSON struct {
	Label string           `json:"label"`
	Rect  homeworkRectJSON `json:"rect"`
}

// homeworkReadingJSON is the model's statement of the problem it solved:
// the box the student checks first when a walkthrough looks wrong.
type homeworkReadingJSON struct {
	Given  []string `json:"given"`
	Find   string   `json:"find"`
	Figure string   `json:"figure"`
}

type homeworkGuideJSON struct {
	Reading   *homeworkReadingJSON `json:"reading"`
	Setup     string               `json:"setup"`
	Hints     []string             `json:"hints"`
	Steps     []string             `json:"steps"`
	Equations []struct {
		Title string `json:"title"`
		Tex   string `json:"tex"`
		Note  string `json:"note"`
	} `json:"equations"`
	Answer string `json:"answer"`
}

// understandingNoteJSON is one durable correction the chat pinned on a
// question. Notes never print on the sheet; they steer the next rewrite.
type understandingNoteJSON struct {
	Note string    `json:"note"`
	At   time.Time `json:"at"`
}

type homeworkQuestionJSON struct {
	ID                 string                  `json:"id"`
	HomeworkID         string                  `json:"homeworkId"`
	Position           int                     `json:"position"`
	Page               *int                    `json:"page"`
	Status             string                  `json:"status"`
	Error              *string                 `json:"error"`
	Standalone         bool                    `json:"standalone"`
	QuestionRect       *homeworkRectJSON       `json:"questionRect"`
	Transcription      string                  `json:"transcription"`
	Diagrams           []homeworkDiagramJSON   `json:"diagrams"`
	UnderstandingNotes []understandingNoteJSON `json:"understandingNotes"`
	Guide              *homeworkGuideJSON      `json:"guide"`
	CreatedAt          time.Time               `json:"createdAt"`
	UpdatedAt          time.Time               `json:"updatedAt"`
}

func rectJSONFrom(r *store.HomeworkRect) *homeworkRectJSON {
	if r == nil {
		return nil
	}
	out := homeworkRectJSON(*r)
	return &out
}

func rectFromJSON(r *homeworkRectJSON) *store.HomeworkRect {
	if r == nil {
		return nil
	}
	out := store.HomeworkRect(*r)
	return &out
}

func questionJSONFrom(q *store.HomeworkQuestion) homeworkQuestionJSON {
	out := homeworkQuestionJSON{
		ID:            q.ID,
		HomeworkID:    q.HomeworkID,
		Position:      q.Position,
		Page:          q.Page,
		Status:        q.Status,
		Standalone:    q.Standalone,
		Transcription: q.Transcription,
		CreatedAt:     q.CreatedAt,
		UpdatedAt:     q.UpdatedAt,
	}
	if q.Error != "" {
		errText := q.Error
		out.Error = &errText
	}
	out.QuestionRect = rectJSONFrom(q.QuestionRect)
	out.Diagrams = make([]homeworkDiagramJSON, 0, len(q.Diagrams))
	for _, d := range q.Diagrams {
		out.Diagrams = append(out.Diagrams, homeworkDiagramJSON{Label: d.Label, Rect: homeworkRectJSON(d.Rect)})
	}
	out.UnderstandingNotes = make([]understandingNoteJSON, 0, len(q.UnderstandingNotes))
	for _, n := range q.UnderstandingNotes {
		out.UnderstandingNotes = append(out.UnderstandingNotes, understandingNoteJSON{Note: n.Note, At: n.At})
	}
	if q.Guide != nil {
		guide := homeworkGuideJSON{
			Setup:  q.Guide.Setup,
			Hints:  q.Guide.Hints,
			Steps:  q.Guide.Steps,
			Answer: q.Guide.Answer,
		}
		for _, eq := range q.Guide.Equations {
			guide.Equations = append(guide.Equations, struct {
				Title string `json:"title"`
				Tex   string `json:"tex"`
				Note  string `json:"note"`
			}{eq.Title, eq.Tex, eq.Note})
		}
		if r := q.Guide.Reading; r != nil {
			given := r.Given
			if given == nil {
				given = []string{}
			}
			guide.Reading = &homeworkReadingJSON{Given: given, Find: r.Find, Figure: r.Figure}
		}
		out.Guide = &guide
	}
	return out
}

// --- CRUD -------------------------------------------------------------------------

type homeworkCreateRequest struct {
	BookSHA256 string  `json:"bookSha256"`
	Title      string  `json:"title"`
	DueDate    *string `json:"dueDate"`
	SourceText string  `json:"sourceText"`
}

// handleHomeworkCreate validates the body, stores a generating assignment,
// and answers 202 with its generation task.
func (s *Server) handleHomeworkCreate(w http.ResponseWriter, r *http.Request) {
	var req homeworkCreateRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	hw, task, err := s.eng.SubmitHomework(r.Context(), engine.HomeworkCreate{
		BookSHA256: req.BookSHA256,
		Title:      req.Title,
		DueDate:    req.DueDate,
		SourceText: req.SourceText,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	view, err := s.eng.TaskView(r.Context(), task.ID)
	if err != nil {
		writeError(w, err)
		return
	}
	ref, err := s.engHomeworkRef(r, hw.ID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{
		"homework": homeworkJSONFromRef(ref),
		"task":     taskJSONFromView(view),
	})
}

// engHomeworkRef reloads a homework's ref form through the engine.
func (s *Server) engHomeworkRef(r *http.Request, id string) (*store.HomeworkRef, error) {
	ref, _, err := s.eng.Homework(r.Context(), id)
	return ref, err
}

func (s *Server) handleHomeworks(w http.ResponseWriter, r *http.Request) {
	refs, err := s.eng.Homeworks(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	out := make([]homeworkJSON, 0, len(refs))
	for i := range refs {
		out = append(out, homeworkJSONFromRef(&refs[i]))
	}
	writeJSON(w, http.StatusOK, map[string]any{"homeworks": out})
}

func (s *Server) handleHomeworkGet(w http.ResponseWriter, r *http.Request) {
	ref, questions, err := s.eng.Homework(r.Context(), r.PathValue("id"))
	if err != nil {
		writeError(w, err)
		return
	}
	qs := make([]homeworkQuestionJSON, 0, len(questions))
	for i := range questions {
		qs = append(qs, questionJSONFrom(&questions[i]))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"homework":  homeworkJSONFromRef(ref),
		"questions": qs,
	})
}

type homeworkUpdateRequest struct {
	Title           *string `json:"title"`
	DueDate         *string `json:"dueDate"`
	TurnedIn        *bool   `json:"turnedIn"`
	HWQuestionScale *int    `json:"questionScale"`
	HWFigureScale   *int    `json:"figureScale"`
}

func (s *Server) handleHomeworkPatch(w http.ResponseWriter, r *http.Request) {
	var req homeworkUpdateRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	ref, err := s.eng.UpdateHomework(r.Context(), r.PathValue("id"), req.Title, req.DueDate, req.TurnedIn, req.HWQuestionScale, req.HWFigureScale)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"homework": homeworkJSONFromRef(ref)})
}

func (s *Server) handleHomeworkDelete(w http.ResponseWriter, r *http.Request) {
	if err := s.eng.DeleteHomework(r.Context(), r.PathValue("id")); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{})
}

// --- direct question mutations ------------------------------------------------------

type questionCreateRequest struct {
	Transcription string                `json:"transcription"`
	Page          *int                  `json:"page"`
	Status        string                `json:"status"`
	Standalone    bool                  `json:"standalone"`
	QuestionRect  *homeworkRectJSON     `json:"questionRect"`
	Diagrams      []homeworkDiagramJSON `json:"diagrams"`
	Guide         *homeworkGuideJSON    `json:"guide"`
}

// handleQuestionCreate inserts a fully-formed question — the undo target
// for a delete.
func (s *Server) handleQuestionCreate(w http.ResponseWriter, r *http.Request) {
	var req questionCreateRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	q := &store.HomeworkQuestion{
		Transcription: strings.TrimSpace(req.Transcription),
		Page:          req.Page,
		Status:        req.Status,
		Standalone:    req.Standalone,
		QuestionRect:  rectFromJSON(req.QuestionRect),
	}
	if q.QuestionRect != nil && !q.QuestionRect.Valid() {
		writeErrorMsg(w, http.StatusBadRequest, "the question region is out of bounds")
		return
	}
	if q.Status == "" {
		q.Status = store.QuestionReady
	}
	for _, d := range req.Diagrams {
		rect := store.HomeworkRect(d.Rect)
		if !rect.Valid() {
			writeErrorMsg(w, http.StatusBadRequest, "a diagram region is out of bounds")
			return
		}
		q.Diagrams = append(q.Diagrams, store.HomeworkDiagram{Label: d.Label, Rect: rect})
	}
	if req.Guide != nil {
		guide := store.HomeworkGuide{
			Setup: req.Guide.Setup, Hints: req.Guide.Hints, Steps: req.Guide.Steps, Answer: req.Guide.Answer,
		}
		if r := req.Guide.Reading; r != nil {
			guide.Reading = &store.HomeworkReading{Given: r.Given, Find: r.Find, Figure: r.Figure}
		}
		for _, eq := range req.Guide.Equations {
			guide.Equations = append(guide.Equations, store.HomeworkEquation{Title: eq.Title, Tex: eq.Tex, Note: eq.Note})
		}
		q.Guide = &guide
	}

	created, err := s.eng.AddQuestion(r.Context(), r.PathValue("id"), q)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"question": questionJSONFrom(created)})
}

func (s *Server) handleQuestionDelete(w http.ResponseWriter, r *http.Request) {
	removed, err := s.eng.RemoveQuestion(r.Context(), r.PathValue("id"), r.PathValue("qid"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"question": questionJSONFrom(removed)})
}

type questionMoveRequest struct {
	Position *int `json:"position"`
}

func (s *Server) handleQuestionPatch(w http.ResponseWriter, r *http.Request) {
	var req questionMoveRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil || req.Position == nil {
		writeErrorMsg(w, http.StatusBadRequest, "a position is required")
		return
	}
	id := r.PathValue("id")
	if err := s.eng.MoveQuestion(r.Context(), id, r.PathValue("qid"), *req.Position); err != nil {
		writeError(w, err)
		return
	}
	ref, questions, err := s.eng.Homework(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	for i := range questions {
		if questions[i].ID == r.PathValue("qid") {
			writeJSON(w, http.StatusOK, map[string]any{
				"question": questionJSONFrom(&questions[i]),
				"homework": homeworkJSONFromRef(ref),
			})
			return
		}
	}
	writeError(w, store.ErrNotFound)
}

// --- the homework chat (SSE) ----------------------------------------------------
//
// One conversation per assignment, anchored to whichever question is
// selected when each message is sent. The event vocabulary is ask's plus
// the tool cards and the question rows a tool changed.

type homeworkChatRequest struct {
	Message    string `json:"message"`
	QuestionID string `json:"questionId"`
}

// handleHomeworkChat streams one chat turn. Failures before the first event
// are ordinary JSON errors with a real status; after it they are error
// events on the open stream.
func (s *Server) handleHomeworkChat(w http.ResponseWriter, r *http.Request) {
	var req homeworkChatRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Message) == "" {
		writeErrorMsg(w, http.StatusBadRequest, "missing message")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeErrorMsg(w, http.StatusInternalServerError, "streaming is not supported here")
		return
	}
	writeEvent, started := sseWriter(w, flusher)

	ans, err := s.eng.HomeworkChat(r.Context(), r.PathValue("id"), req.QuestionID, req.Message,
		func(ev engine.ChatEvent) error { return writeChatEvent(writeEvent, ev) })
	if err != nil {
		if !*started {
			writeError(w, err)
			return
		}
		_, msg := errorStatus(err)
		writeEvent(map[string]any{"type": "error", "error": msg})
		return
	}
	writeEvent(map[string]any{"type": "done", "messageId": ans.MessageID})
}

// writeChatEvent maps one engine chat event onto the wire vocabulary: the
// ask events keep their own names, so a client folds both streams with one
// reducer.
func writeChatEvent(writeEvent func(any) error, ev engine.ChatEvent) error {
	switch ev.Type {
	case engine.ChatMeta:
		return writeEvent(map[string]any{
			"type":           "meta",
			"conversationId": ev.ConversationID,
			"questionId":     ev.QuestionID,
		})
	case engine.ChatAsk:
		return writeAskEvent(writeEvent, ev.Ask)
	case engine.ChatToolStart:
		return writeEvent(map[string]any{
			"type": "tool-start", "id": ev.Tool.ID, "tool": ev.Tool.Tool,
			"args": rawOrEmpty(ev.Tool.Args),
		})
	case engine.ChatToolResult:
		return writeEvent(map[string]any{
			"type": "tool-result", "id": ev.Tool.ID, "tool": ev.Tool.Tool,
			"args": rawOrEmpty(ev.Tool.Args), "ok": ev.Tool.OK,
			"summary": ev.Tool.Result, "pages": intsOrEmpty(ev.Tool.Pages),
		})
	case engine.ChatQuestion:
		return writeEvent(map[string]any{"type": "question", "question": questionJSONFrom(ev.Question)})
	}
	return nil
}

func rawOrEmpty(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage("{}")
	}
	return raw
}

func intsOrEmpty(v []int) []int {
	if v == nil {
		return []int{}
	}
	return v
}

// handleHomeworkChatHistory restores the assignment's chat on load. An
// assignment nobody has chatted about answers with a null conversation and
// no messages rather than a 404.
func (s *Server) handleHomeworkChatHistory(w http.ResponseWriter, r *http.Request) {
	conv, messages, err := s.eng.HomeworkChatHistory(r.Context(), r.PathValue("id"))
	if err != nil {
		writeError(w, err)
		return
	}
	msgs := make([]messageJSON, 0, len(messages))
	for _, m := range messages {
		msgs = append(msgs, messageWire(m))
	}
	var convJSON any
	if conv != nil {
		convJSON = conversationJSON{
			ID:             conv.ID,
			Title:          conv.Title,
			Pinned:         conv.Pinned,
			MessageCount:   len(messages),
			CreatedAt:      conv.CreatedAt,
			LastActivityAt: conv.UpdatedAt,
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": convJSON, "messages": msgs})
}

// --- deliverables ----------------------------------------------------------------------

// handleHomeworkPDF streams the deterministic template as a download.
func (s *Server) handleHomeworkPDF(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.eng.HomeworkPDFReady(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.eng.HomeworkPDF(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", "homework-"+id+".pdf"))
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// handleQuestionImage renders a question screenshot or diagram crop.
func (s *Server) handleQuestionImage(w http.ResponseWriter, r *http.Request) {
	variant := r.URL.Query().Get("variant")
	if variant == "" {
		variant = "question"
	}
	n := 0
	if raw := r.URL.Query().Get("n"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 {
			writeErrorMsg(w, http.StatusBadRequest, "invalid diagram index")
			return
		}
		n = parsed
	}
	jpegData, err := s.eng.HomeworkQuestionImage(r.Context(), r.PathValue("id"), r.PathValue("qid"), variant, n)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "private, max-age=3600")
	w.WriteHeader(http.StatusOK)
	w.Write(jpegData)
}

// --- question repair ---------------------------------------------------------
//
// Repairs are direct requests, not tasks: each is one model call at most, and
// each touches exactly the stage that was wrong. They answer with the
// repaired question so the card can re-render itself and nothing else.

// adjustRequest is the Adjust panel's payload: hand corrections only. Words
// go through the tutor chat, which plans the same repairs from an
// instruction.
type adjustRequest struct {
	Page         *int                    `json:"page"`
	QuestionRect *store.HomeworkRect     `json:"questionRect"`
	Diagrams     []store.HomeworkDiagram `json:"diagrams"`
	Standalone   *bool                   `json:"standalone"`
}

func (s *Server) handleQuestionAdjust(w http.ResponseWriter, r *http.Request) {
	var req adjustRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	q, err := s.eng.AdjustQuestion(r.Context(), r.PathValue("qid"), engine.QuestionAdjust{
		Page:         req.Page,
		QuestionRect: req.QuestionRect,
		Diagrams:     req.Diagrams,
		Standalone:   req.Standalone,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"question": questionJSONFrom(q)})
}

// relocateRequest names a page the student knows, a note about what was
// wrong, or both. A page turns searching the whole book into finding a
// region on one page.
type relocateRequest struct {
	Page *int   `json:"page"`
	Note string `json:"note"`
	Text string `json:"text"`
}

// Relocating and rewriting are minutes-long model calls, so each is a task:
// it survives the page that started it, resumes after a restart, and can be
// stopped and retried like any other work. Progress arrives on the shared
// event stream, per phase, so there is nothing bespoke to subscribe to.

func (s *Server) handleQuestionRelocate(w http.ResponseWriter, r *http.Request) {
	var req relocateRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	qid := r.PathValue("qid")
	if req.Text != "" {
		if _, err := s.eng.EditQuestionText(r.Context(), qid, req.Text); err != nil {
			writeError(w, err)
			return
		}
	}
	task, err := s.eng.RelocateQuestion(r.Context(), qid, req.Page, req.Note)
	if err != nil {
		writeError(w, err)
		return
	}
	s.writeQuestionTask(w, r, qid, task)
}

type rewriteRequest struct {
	Note string `json:"note"`
}

func (s *Server) handleQuestionRewrite(w http.ResponseWriter, r *http.Request) {
	var req rewriteRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	qid := r.PathValue("qid")
	task, err := s.eng.RewriteQuestion(r.Context(), qid, req.Note)
	if err != nil {
		writeError(w, err)
		return
	}
	s.writeQuestionTask(w, r, qid, task)
}

// writeQuestionTask answers a queued repair with both halves the workspace
// needs: the task to watch, and the question row as it stands now (already
// marked pending), so the outline updates without a refetch.
func (s *Server) writeQuestionTask(w http.ResponseWriter, r *http.Request, qid string, task *store.Task) {
	view, err := s.eng.TaskView(r.Context(), task.ID)
	if err != nil {
		writeError(w, err)
		return
	}
	q, err := s.eng.Question(r.Context(), qid)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{
		"task":     taskJSONFromView(view),
		"question": questionJSONFrom(q),
	})
}

// decodeJSONBody reads an optional JSON body into v; an empty body is fine.
func decodeJSONBody(r *http.Request, v any) error {
	if r.Body == nil {
		return nil
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	return nil
}

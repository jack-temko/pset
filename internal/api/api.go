// Package api is the HTTP adapter: it serves the JSON API under /api/ and
// the embedded SPA everywhere else. Presentation lives here; behaviour is
// reached through the engine.
package api

import (
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackt/pset/internal/engine"
	"github.com/jackt/pset/web"
)

// Server holds the adapter's dependencies. It is stateless: every request
// goes through the engine, which also owns the background job runner.
type Server struct {
	version string
	eng     *engine.Engine
}

func New(version string, eng *engine.Engine) *Server {
	return &Server{version: version, eng: eng}
}

// Handler returns the full HTTP handler: API routes plus the SPA.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/books", s.handleBooks)
	mux.HandleFunc("GET /api/books/{sha}", s.handleBook)
	mux.HandleFunc("GET /api/books/{sha}/pages/{n}", s.handlePage)
	mux.HandleFunc("GET /api/books/{sha}/pages/{n}/image", s.handlePageImage)
	mux.HandleFunc("GET /api/books/{sha}/sections", s.handleSections)
	mux.HandleFunc("DELETE /api/books/{sha}", s.handleBookRemove)
	mux.HandleFunc("POST /api/books/{sha}/ask", s.handleAsk)
	mux.HandleFunc("GET /api/books/{sha}/conversations", s.handleConversations)
	mux.HandleFunc("GET /api/books/{sha}/conversations/{id}", s.handleConversation)
	mux.HandleFunc("DELETE /api/books/{sha}/conversations/{id}", s.handleConversationDelete)
	mux.HandleFunc("POST /api/import", s.handleImport)
	mux.HandleFunc("GET /api/config", s.handleGetConfig)
	mux.HandleFunc("PUT /api/config", s.handlePutConfig)
	mux.HandleFunc("POST /api/config/test", s.handleConfigTest)
	mux.HandleFunc("GET /api/conversations", s.handleAllConversations)
	mux.HandleFunc("GET /api/conversations/{id}", s.handleConversationByRef)
	mux.HandleFunc("PATCH /api/conversations/{id}", s.handleConversationUpdate)
	mux.HandleFunc("GET /api/tasks", s.handleTasks)
	mux.HandleFunc("GET /api/tasks/{id}", s.handleTask)
	mux.HandleFunc("POST /api/tasks/{id}/stop", s.handleTaskStop)
	mux.HandleFunc("POST /api/tasks/{id}/retry", s.handleTaskRetry)
	mux.HandleFunc("GET /api/events", s.handleEvents)
	mux.HandleFunc("POST /api/homework", s.handleHomeworkCreate)
	mux.HandleFunc("GET /api/homework", s.handleHomeworks)
	mux.HandleFunc("GET /api/homework/{id}", s.handleHomeworkGet)
	mux.HandleFunc("PATCH /api/homework/{id}", s.handleHomeworkPatch)
	mux.HandleFunc("DELETE /api/homework/{id}", s.handleHomeworkDelete)
	mux.HandleFunc("POST /api/homework/{id}/chat", s.handleHomeworkChat)
	mux.HandleFunc("GET /api/homework/{id}/chat", s.handleHomeworkChatHistory)
	mux.HandleFunc("GET /api/homework/{id}/pdf", s.handleHomeworkPDF)
	mux.HandleFunc("POST /api/homework/{id}/questions", s.handleQuestionCreate)
	mux.HandleFunc("DELETE /api/homework/{id}/questions/{qid}", s.handleQuestionDelete)
	mux.HandleFunc("PATCH /api/homework/{id}/questions/{qid}", s.handleQuestionPatch)
	mux.HandleFunc("GET /api/homework/{id}/questions/{qid}/image", s.handleQuestionImage)
	mux.HandleFunc("POST /api/homework/{id}/questions/{qid}/adjust", s.handleQuestionAdjust)
	mux.HandleFunc("POST /api/homework/{id}/questions/{qid}/relocate", s.handleQuestionRelocate)
	mux.HandleFunc("POST /api/homework/{id}/questions/{qid}/rewrite", s.handleQuestionRewrite)
	mux.HandleFunc("GET /api/doctor", s.handleDoctorCheck)
	mux.HandleFunc("POST /api/doctor", s.handleDoctorFix)
	mux.HandleFunc("POST /api/reset", s.handleReset)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	})
	mux.Handle("/", SPAHandler())
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":           "ok",
		"version":          s.version,
		"databasePath":     s.eng.DBPath(),
		"libraryDirectory": s.eng.LibraryDir(),
	})
}

// bookJSON is the wire form of a book. It is built from engine results, so
// this package never imports internal/store.
// bookJSON is the wire form of one book. Readiness is derived on every read
// rather than stored, so a book that lost data reports it at once; ready and
// the counts behind it are the whole of a book's preparation state — there
// are no separate text/index/search flags to disagree with each other.
type bookJSON struct {
	ID          string           `json:"id"`
	SHA256      string           `json:"sha256"`
	Title       string           `json:"title"`
	Author      string           `json:"author"`
	Subject     string           `json:"subject"`
	PageCount   int              `json:"pageCount"`
	Ready       bool             `json:"ready"`
	Readiness   readinessJSON    `json:"readiness"`
	FailedPages []failedPageJSON `json:"failedPages"`
	Task        *taskJSON        `json:"task"`
	Kind        string           `json:"kind"`
	PDFVersion  string           `json:"pdfVersion"`
	PageWidth   float64          `json:"pageWidth"`
	PageHeight  float64          `json:"pageHeight"`
	FileSize    int64            `json:"fileSize"`
	OriginPath  string           `json:"originPath"`
	LibraryPath string           `json:"libraryPath"`
	ImportedAt  time.Time        `json:"importedAt"`
}

// readinessJSON is the count behind ready, so the UI can say what is missing
// without a second request.
type readinessJSON struct {
	PagesStored   int    `json:"pagesStored"`
	PagesFailed   int    `json:"pagesFailed"`
	PagesWithText int    `json:"pagesWithText"`
	Sections      int    `json:"sections"`
	Vectors       int    `json:"vectors"`
	Missing       string `json:"missing"`
}

// failedPageJSON names one page whose text a tool failed to produce. Blank
// pages never appear here: a blank page is a finished page.
type failedPageJSON struct {
	Page  int    `json:"page"`
	Error string `json:"error"`
}

func bookJSONFromStatus(st *engine.BookStatus) bookJSON {
	b := st.Book
	out := bookJSON{
		ID:        b.ID,
		SHA256:    b.SHA256,
		Title:     b.Title,
		Author:    b.Author,
		Subject:   b.Subject,
		PageCount: b.PageCount,
		Ready:     st.Readiness.Ready(),
		Readiness: readinessJSON{
			PagesStored:   st.Readiness.PagesStored,
			PagesFailed:   st.Readiness.PagesFailed,
			PagesWithText: st.Readiness.PagesWithText,
			Sections:      st.Readiness.Sections,
			Vectors:       st.Readiness.Vectors,
			Missing:       st.Readiness.Missing(),
		},
		FailedPages: make([]failedPageJSON, 0, len(st.FailedPages)),
		Kind:        b.Kind,
		PDFVersion:  b.PDFVersion,
		PageWidth:   b.PageWidth,
		PageHeight:  b.PageHeight,
		FileSize:    b.FileSize,
		OriginPath:  b.OriginPath,
		LibraryPath: b.FilePath,
		ImportedAt:  b.CreatedAt,
	}
	for _, p := range st.FailedPages {
		out.FailedPages = append(out.FailedPages, failedPageJSON{Page: p.Number, Error: p.Error})
	}
	if st.Task != nil {
		t := taskJSONFromView(st.Task)
		out.Task = &t
	}
	return out
}

// sectionJSON is the wire form of one stored section.
type sectionJSON struct {
	SortOrder int    `json:"sortOrder"`
	Level     int    `json:"level"`
	Title     string `json:"title"`
	Source    string `json:"source"`
	StartPage int    `json:"startPage"`
	EndPage   int    `json:"endPage"`
}

// phaseJSON is the wire form of one phase row. done/total drive the progress
// bar (total 0 means uncounted), note is live display text, and etaSeconds is
// null unless the phase is running and counted.
type phaseJSON struct {
	ID         string     `json:"id"`
	TaskID     string     `json:"taskId"`
	Key        string     `json:"key"`
	Name       string     `json:"name"`
	Status     string     `json:"status"`
	Done       int        `json:"done"`
	Total      int        `json:"total"`
	Note       string     `json:"note"`
	Error      *string    `json:"error"`
	EtaSeconds *float64   `json:"etaSeconds"`
	CreatedAt  time.Time  `json:"createdAt"`
	StartedAt  *time.Time `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt"`
}

func phaseJSONFrom(ph *engine.Phase) phaseJSON {
	out := phaseJSON{
		ID:         ph.ID,
		TaskID:     ph.TaskID,
		Key:        ph.Key,
		Name:       ph.Name,
		Status:     ph.Status,
		Done:       ph.Done,
		Total:      ph.Total,
		Note:       ph.Note,
		EtaSeconds: ph.EtaSeconds,
		CreatedAt:  ph.CreatedAt,
	}
	if ph.Error != "" {
		errText := ph.Error
		out.Error = &errText
	}
	if !ph.StartedAt.IsZero() {
		started := ph.StartedAt
		out.StartedAt = &started
	}
	if !ph.FinishedAt.IsZero() {
		finished := ph.FinishedAt
		out.FinishedAt = &finished
	}
	return out
}

// taskJSON is the wire form of a task. failKind classifies a failure so the
// client renders the right door without parsing error text, and retryable
// says outright whether offering one would be honest.
type taskJSON struct {
	ID         string      `json:"id"`
	Kind       string      `json:"kind"`
	QuestionID string      `json:"questionId,omitempty"`
	Status     string      `json:"status"`
	BookID     *string     `json:"bookId"`
	HomeworkID *string     `json:"homeworkId"`
	Title      string      `json:"title"`
	Phases     []phaseJSON `json:"phases"`
	FailKind   *string     `json:"failKind"`
	Retryable  bool        `json:"retryable"`
	Error      *string     `json:"error"`
	CreatedAt  time.Time   `json:"createdAt"`
	StartedAt  *time.Time  `json:"startedAt"`
	FinishedAt *time.Time  `json:"finishedAt"`
}

func taskJSONFromView(v *engine.TaskView) taskJSON {
	t := taskJSON{
		ID:         v.ID,
		Kind:       v.Kind,
		Status:     v.Status,
		BookID:     v.BookID,
		HomeworkID: v.HomeworkID,
		QuestionID: v.QuestionID,
		Title:      v.Title,
		Phases:     make([]phaseJSON, 0, len(v.Phases)),
		Retryable:  v.Retryable(),
		CreatedAt:  v.CreatedAt,
	}
	for _, ph := range v.Phases {
		t.Phases = append(t.Phases, phaseJSONFrom(ph))
	}
	if v.FailKind != "" {
		kind := v.FailKind
		t.FailKind = &kind
	}
	if v.Error != "" {
		t.Error = &v.Error
	}
	if !v.StartedAt.IsZero() {
		started := v.StartedAt
		t.StartedAt = &started
	}
	if !v.FinishedAt.IsZero() {
		finished := v.FinishedAt
		t.FinishedAt = &finished
	}
	return t
}

func (s *Server) handleBooks(w http.ResponseWriter, r *http.Request) {
	statuses, err := s.eng.BookStatuses(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	books := make([]bookJSON, 0, len(statuses))
	for _, st := range statuses {
		books = append(books, bookJSONFromStatus(st))
	}
	writeJSON(w, http.StatusOK, map[string]any{"books": books})
}

func (s *Server) handleBook(w http.ResponseWriter, r *http.Request) {
	st, err := s.eng.BookStatus(r.Context(), r.PathValue("sha"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, bookJSONFromStatus(st))
}

func (s *Server) handlePage(w http.ResponseWriter, r *http.Request) {
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || n < 1 {
		writeErrorMsg(w, http.StatusBadRequest, "invalid page number "+strconv.Quote(r.PathValue("n")))
		return
	}
	sha, text, err := s.eng.PageText(r.Context(), r.PathValue("sha"), n)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sha256": sha, "page": n, "text": text})
}

func (s *Server) handleSections(w http.ResponseWriter, r *http.Request) {
	bs, err := s.eng.BookSections(r.Context(), r.PathValue("sha"))
	if err != nil {
		writeError(w, err)
		return
	}
	sections := make([]sectionJSON, 0, len(bs.Sections))
	for _, sec := range bs.Sections {
		sections = append(sections, sectionJSON{
			SortOrder: sec.SortOrder,
			Level:     sec.Level,
			Title:     sec.Title,
			Source:    sec.Source,
			StartPage: sec.StartPage,
			EndPage:   sec.EndPage,
		})
	}
	writeJSON(w, http.StatusOK, sections)
}

// --- import ------------------------------------------------------------------

type importRequest struct {
	Path string `json:"path"`
}

// handleImport accepts either a multipart upload with a "file" part or a
// JSON body naming a server-side path. Both answer synchronously: 200 with
// the existing book when the content is already in the library, else 202
// with the freshly queued prepare task.
func (s *Server) handleImport(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			writeErrorMsg(w, http.StatusBadRequest, "invalid multipart form")
			return
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			writeErrorMsg(w, http.StatusBadRequest, `missing "file" part`)
			return
		}
		defer file.Close()
		name := header.Filename
		if name == "" {
			name = "upload.pdf"
		}
		sub, err := s.eng.SubmitImportReader(r.Context(), file, name)
		s.writeImport(w, r, sub, err)
		return
	}

	var req importRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Path == "" {
		writeErrorMsg(w, http.StatusBadRequest, "missing path")
		return
	}
	sub, err := s.eng.SubmitImport(r.Context(), req.Path)
	s.writeImport(w, r, sub, err)
}

func (s *Server) writeImport(w http.ResponseWriter, r *http.Request, sub *engine.ImportSubmission, err error) {
	if err != nil {
		writeError(w, err)
		return
	}
	if sub.Duplicated {
		st, err := s.eng.BookStatus(r.Context(), sub.Book.SHA256)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"book":       bookJSONFromStatus(st),
			"task":       nil,
			"duplicated": true,
		})
		return
	}
	view, err := s.eng.TaskView(r.Context(), sub.Task.ID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{
		"book":       nil,
		"task":       taskJSONFromView(view),
		"duplicated": false,
	})
}

// --- tasks -------------------------------------------------------------------

func (s *Server) handleTasks(w http.ResponseWriter, r *http.Request) {
	views, err := s.eng.TaskViews(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	tasks := make([]taskJSON, 0, len(views))
	for _, v := range views {
		tasks = append(tasks, taskJSONFromView(v))
	}
	writeJSON(w, http.StatusOK, map[string]any{"tasks": tasks})
}

func (s *Server) handleTask(w http.ResponseWriter, r *http.Request) {
	id, ok := parseTaskID(w, r)
	if !ok {
		return
	}
	view, err := s.eng.TaskView(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"task": taskJSONFromView(view)})
}

func (s *Server) handleTaskStop(w http.ResponseWriter, r *http.Request) {
	id, ok := parseTaskID(w, r)
	if !ok {
		return
	}
	task, err := s.eng.StopTask(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	s.writeTaskAccepted(w, r, task.ID)
}

func (s *Server) handleTaskRetry(w http.ResponseWriter, r *http.Request) {
	id, ok := parseTaskID(w, r)
	if !ok {
		return
	}
	task, err := s.eng.RetryTask(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	s.writeTaskAccepted(w, r, task.ID)
}

func (s *Server) writeTaskAccepted(w http.ResponseWriter, r *http.Request, id string) {
	view, err := s.eng.TaskView(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"task": taskJSONFromView(view)})
}

func parseTaskID(w http.ResponseWriter, r *http.Request) (string, bool) {
	id := r.PathValue("id")
	if id == "" {
		writeErrorMsg(w, http.StatusBadRequest, "invalid task id")
		return "", false
	}
	return id, true
}

// --- book operations ---------------------------------------------------------

// handleBookRemove is the only door that deletes: stopping and failing both
// keep their work, so removing a book is always an explicit choice.
func (s *Server) handleBookRemove(w http.ResponseWriter, r *http.Request) {
	book, err := s.eng.RemoveBook(r.Context(), r.PathValue("sha"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"removed": book.SHA256, "title": book.Title})
}

// --- doctor and reset ----------------------------------------------------------

type doctorCheckJSON struct {
	Name     string              `json:"name"`
	Status   string              `json:"status"`
	Findings []doctorFindingJSON `json:"findings"`
}

type doctorFindingJSON struct {
	Severity string          `json:"severity"`
	Message  string          `json:"message"`
	Link     *doctorLinkJSON `json:"link,omitempty"`
}

type doctorLinkJSON struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

func (s *Server) handleDoctorCheck(w http.ResponseWriter, r *http.Request) {
	s.writeDoctor(w, r, false)
}

func (s *Server) handleDoctorFix(w http.ResponseWriter, r *http.Request) {
	s.writeDoctor(w, r, true)
}

func (s *Server) writeDoctor(w http.ResponseWriter, r *http.Request, fix bool) {
	rep := s.eng.Doctor(r.Context(), engine.DoctorOptions{Fix: fix})
	checks := make([]doctorCheckJSON, 0, len(rep.Checks))
	for _, c := range rep.Checks {
		findings := make([]doctorFindingJSON, 0, len(c.Findings))
		for _, f := range c.Findings {
			finding := doctorFindingJSON{Severity: string(f.Severity), Message: f.Message}
			if f.Link != nil {
				finding.Link = &doctorLinkJSON{Label: f.Link.Label, Href: f.Link.Href}
			}
			findings = append(findings, finding)
		}
		checks = append(checks, doctorCheckJSON{Name: c.Name, Status: string(c.Status), Findings: findings})
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": rep.OK(), "checks": checks})
}

type resetRequest struct {
	Apply bool `json:"apply"`
}

func (s *Server) handleReset(w http.ResponseWriter, r *http.Request) {
	var req resetRequest
	// An empty body is a check-only reset.
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeErrorMsg(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	res, err := s.eng.Reset(r.Context(), engine.ResetOptions{Apply: req.Apply})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"books":         res.Books,
		"pages":         res.Pages,
		"libraryFiles":  res.LibraryFiles,
		"finishedTasks": res.FinishedTasks,
	})
}

// --- errors and encoding -------------------------------------------------------

type errorBody struct {
	Error  string   `json:"error"`
	Detail []string `json:"detail,omitempty"`
}

// writeErrorMsg answers a request-level failure (bad input) in the shared
// error shape.
func writeErrorMsg(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorBody{Error: msg})
}

// writeError maps an engine failure onto the shared error body. User-facing
// failures answer with their clean message at a request-appropriate status;
// anything else is an internal failure and answers generically. detail
// carries the unwrapped error chain.
func writeError(w http.ResponseWriter, err error) {
	status, msg := errorStatus(err)

	var detail []string
	for inner := errors.Unwrap(err); inner != nil; inner = errors.Unwrap(inner) {
		detail = append(detail, inner.Error())
	}
	writeJSON(w, status, errorBody{Error: msg, Detail: detail})
}

// errorStatus picks the response status and user-facing message for a
// failure — shared by the JSON error body and the SSE error event.
func errorStatus(err error) (int, string) {
	status, msg := http.StatusInternalServerError, "internal error"

	var noMatch *engine.NoMatchError
	var ambiguous *engine.AmbiguousError
	var textLayer *engine.TextLayerError
	var settled *engine.TaskSettledError
	var active *engine.TaskActiveError
	var resetBlocked *engine.ResetBlockedError
	var unconfigured *engine.LLMUnconfiguredError
	var noEmbed *engine.EmbedUnconfiguredError
	var permanent *engine.PermanentError
	var environment *engine.EnvironmentError
	var user *engine.UserError
	switch {
	case errors.As(err, &noMatch):
		status, msg = http.StatusNotFound, err.Error()
	case errors.As(err, &ambiguous), errors.As(err, &textLayer),
		errors.As(err, &settled), errors.As(err, &active), errors.As(err, &resetBlocked):
		status, msg = http.StatusConflict, err.Error()
	case errors.As(err, &unconfigured), errors.As(err, &noEmbed),
		errors.As(err, &permanent), errors.As(err, &environment), errors.As(err, &user):
		// All of these already read as a sentence a student can act on, so
		// they travel verbatim rather than becoming a generic 500.
		status, msg = http.StatusBadRequest, err.Error()
	case errors.Is(err, engine.ErrNoPage):
		status, msg = http.StatusNotFound, err.Error()
	case errors.Is(err, engine.ErrTaskNotFound):
		status, msg = http.StatusNotFound, err.Error()
	}
	return status, msg
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// SPAHandler serves the embedded frontend. Before the first frontend build
// it answers with guidance instead of the app.
func SPAHandler() http.Handler {
	dist, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		return notBuiltHandler{}
	}
	return newSPAHandler(dist)
}

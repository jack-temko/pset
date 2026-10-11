package homework

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/usage"
)

// Routes mounts the homework endpoints.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/books/{id}/homework", httpx.Reply(func(r *http.Request) (List, error) {
		list, err := s.ForBook(r.Context(), r.PathValue("id"))
		return List{Homework: list}, err
	}))
	mux.HandleFunc("POST /api/books/{id}/homework", httpx.Send(http.StatusCreated, func(r *http.Request, in Input) (Summary, error) {
		return s.Create(r.Context(), r.PathValue("id"), in)
	}))
	// Reading an assignment starts it in the background: a file as a
	// multipart upload, or a web page or pasted text as JSON.
	mux.HandleFunc("POST /api/books/{id}/assignments/read", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var file *AssignmentFile
		var in AssignmentText
		if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/") {
			f, setID, err := assignmentUpload(r)
			if err != nil {
				return err
			}
			file, in.SetID = f, setID
		} else if err := httpx.Decode(r, &in); err != nil {
			return err
		}
		read, err := s.StartRead(r.Context(), r.PathValue("id"), file, in)
		if err != nil {
			return err
		}
		httpx.JSON(w, http.StatusAccepted, read)
		return nil
	}))
	mux.HandleFunc("GET /api/books/{id}/assignments/reads", httpx.Reply(func(r *http.Request) (AssignmentReads, error) {
		reads, err := s.Reads(r.Context(), r.PathValue("id"))
		return AssignmentReads{Reads: reads}, err
	}))
	mux.HandleFunc("GET /api/assignment-reads/{id}", httpx.Reply(func(r *http.Request) (AssignmentRead, error) {
		return s.Read(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/assignment-reads/{id}/usage", httpx.Reply(func(r *http.Request) (*usage.Detail, error) {
		calls, err := usage.Calls(r.Context(), s.c.DB, usage.SubjectRead, r.PathValue("id"))
		return usage.Build(calls, nil, 0), err
	}))
	mux.HandleFunc("GET /api/questions/{id}/usage", httpx.Reply(func(r *http.Request) (*usage.Detail, error) {
		return s.QuestionUsage(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("POST /api/assignment-reads/{id}/retry", httpx.Reply(func(r *http.Request) (AssignmentRead, error) {
		return s.RetryRead(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("DELETE /api/assignment-reads/{id}", httpx.Act(func(r *http.Request) error {
		return s.DismissRead(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("POST /api/books/{id}/assignments", httpx.Send(http.StatusCreated, func(r *http.Request, in AssignmentImport) (List, error) {
		sets, err := s.ImportAssignment(r.Context(), r.PathValue("id"), in)
		return List{Homework: sets}, err
	}))
	mux.HandleFunc("GET /api/books/{id}/assignments/source", httpx.Reply(func(r *http.Request) (AssignmentSource, error) {
		return s.LastSource(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("POST /api/books/{id}/references", httpx.Send(http.StatusOK, func(r *http.Request, in ReferenceLines) (LineReadings, error) {
		return s.ReadLines(r.Context(), r.PathValue("id"), in.Lines)
	}))
	mux.HandleFunc("GET /api/due", httpx.Reply(func(r *http.Request) (List, error) {
		list, err := s.Due(r.Context())
		return List{Homework: list}, err
	}))
	mux.HandleFunc("GET /api/homework/{id}", httpx.Reply(func(r *http.Request) (Detail, error) {
		return s.Get(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("PATCH /api/homework/{id}", httpx.Send(http.StatusOK, func(r *http.Request, p Patch) (Summary, error) {
		return s.Update(r.Context(), r.PathValue("id"), p)
	}))
	mux.HandleFunc("DELETE /api/homework/{id}", httpx.Act(func(r *http.Request) error {
		return s.Delete(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("POST /api/homework/{id}/questions", httpx.Send(http.StatusCreated, func(r *http.Request, in AddQuestions) (Questions, error) {
		qs, err := s.Add(r.Context(), r.PathValue("id"), in.Drafts)
		return Questions{Questions: qs}, err
	}))
	mux.HandleFunc("POST /api/homework/{id}/boxed", httpx.Send(http.StatusCreated, func(r *http.Request, in Boxes) (Question, error) {
		return s.AddBoxed(r.Context(), r.PathValue("id"), in.Boxes)
	}))
	mux.HandleFunc("POST /api/questions/{id}/boxes", httpx.Send(http.StatusOK, func(r *http.Request, in Boxes) (Question, error) {
		return s.PointOut(r.Context(), r.PathValue("id"), in.Boxes)
	}))
	mux.HandleFunc("GET /api/homework/{id}/worksheet", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		data, err := s.Worksheet(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Disposition", `inline; filename="worksheet.pdf"`)
		httpx.Write(w, data)
		return nil
	}))
	mux.HandleFunc("PATCH /api/questions/{id}", httpx.Send(http.StatusOK, func(r *http.Request, p QuestionPatch) (Question, error) {
		return s.UpdateQuestion(r.Context(), r.PathValue("id"), p)
	}))
	mux.HandleFunc("DELETE /api/questions/{id}", httpx.Act(func(r *http.Request) error {
		return s.RemoveQuestion(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("POST /api/questions/{id}/guide", httpx.Reply(func(r *http.Request) (Question, error) {
		return s.WriteGuide(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("POST /api/questions/{id}/retry", httpx.Send(http.StatusOK, func(r *http.Request, in Retry) (Question, error) {
		return s.RetryQuestion(r.Context(), r.PathValue("id"), in)
	}))
	mux.HandleFunc("GET /api/questions/{id}/figures/{n}", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		n, err := strconv.Atoi(r.PathValue("n"))
		if err != nil {
			return httpx.NotFound("figure")
		}
		data, err := s.Figure(r.Context(), r.PathValue("id"), n)
		if err != nil {
			return err
		}
		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Cache-Control", "no-cache")
		httpx.Write(w, data)
		return nil
	}))
}

// assignmentUpload is the file of a multipart upload, read whole (an
// assignment is a few pages, never a textbook), and the set it updates,
// if a setId field comes before it.
func assignmentUpload(r *http.Request) (*AssignmentFile, string, error) {
	mr, err := r.MultipartReader()
	if err != nil {
		return nil, "", httpx.Invalid("file", "Send the file as a multipart upload.")
	}
	setID := ""
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			return nil, "", httpx.Invalid("file", "No file came with the upload.")
		}
		if err != nil {
			return nil, "", httpx.Invalid("file", "The upload was cut off.")
		}
		switch part.FormName() {
		case "setId":
			b, _ := io.ReadAll(io.LimitReader(part, 100))
			setID = strings.TrimSpace(string(b))
		case "file":
			data, err := io.ReadAll(io.LimitReader(part, maxAssignmentBytes+1))
			if err != nil {
				return nil, "", httpx.Invalid("file", "The upload was cut off.")
			}
			return &AssignmentFile{Name: part.FileName(), Data: data}, setID, nil
		}
	}
}

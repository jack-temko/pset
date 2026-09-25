package homework

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackt/pset/internal/httpx"
)

// Routes mounts the homework endpoints.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/books/{id}/homework", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		list, err := s.ForBook(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		return httpx.OK(w, List{Homework: list})
	}))
	mux.HandleFunc("POST /api/books/{id}/homework", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var in Input
		if err := httpx.Decode(r, &in); err != nil {
			return err
		}
		h, err := s.Create(r.Context(), r.PathValue("id"), in)
		if err != nil {
			return err
		}
		httpx.JSON(w, http.StatusCreated, h)
		return nil
	}))
	// Reading an assignment: a file as a multipart upload, or a web page
	// or pasted text as JSON.
	mux.HandleFunc("POST /api/books/{id}/assignments/read", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var file *AssignmentFile
		var in AssignmentText
		if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/") {
			f, err := assignmentUpload(r)
			if err != nil {
				return err
			}
			file = f
		} else if err := httpx.Decode(r, &in); err != nil {
			return err
		}
		a, err := s.ReadAssignment(r.Context(), r.PathValue("id"), file, in)
		if err != nil {
			return err
		}
		return httpx.OK(w, a)
	}))
	mux.HandleFunc("POST /api/books/{id}/assignments", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var in AssignmentImport
		if err := httpx.Decode(r, &in); err != nil {
			return err
		}
		sets, err := s.ImportAssignment(r.Context(), r.PathValue("id"), in)
		if err != nil {
			return err
		}
		httpx.JSON(w, http.StatusCreated, List{Homework: sets})
		return nil
	}))
	mux.HandleFunc("GET /api/books/{id}/assignments/source", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		src, err := s.LastSource(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		return httpx.OK(w, src)
	}))
	mux.HandleFunc("GET /api/due", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		list, err := s.Due(r.Context())
		if err != nil {
			return err
		}
		return httpx.OK(w, List{Homework: list})
	}))
	mux.HandleFunc("GET /api/homework/{id}", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		d, err := s.Get(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		return httpx.OK(w, d)
	}))
	mux.HandleFunc("PATCH /api/homework/{id}", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var p Patch
		if err := httpx.Decode(r, &p); err != nil {
			return err
		}
		h, err := s.Update(r.Context(), r.PathValue("id"), p)
		if err != nil {
			return err
		}
		return httpx.OK(w, h)
	}))
	mux.HandleFunc("DELETE /api/homework/{id}", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		if err := s.Delete(r.Context(), r.PathValue("id")); err != nil {
			return err
		}
		return httpx.NoContent(w)
	}))
	mux.HandleFunc("POST /api/homework/{id}/questions", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var in AddQuestions
		if err := httpx.Decode(r, &in); err != nil {
			return err
		}
		qs, err := s.Add(r.Context(), r.PathValue("id"), in.Drafts)
		if err != nil {
			return err
		}
		httpx.JSON(w, http.StatusCreated, Questions{Questions: qs})
		return nil
	}))
	mux.HandleFunc("POST /api/homework/{id}/boxed", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var in Boxes
		if err := httpx.Decode(r, &in); err != nil {
			return err
		}
		q, err := s.AddBoxed(r.Context(), r.PathValue("id"), in.Boxes)
		if err != nil {
			return err
		}
		httpx.JSON(w, http.StatusCreated, q)
		return nil
	}))
	mux.HandleFunc("POST /api/questions/{id}/boxes", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var in Boxes
		if err := httpx.Decode(r, &in); err != nil {
			return err
		}
		q, err := s.PointOut(r.Context(), r.PathValue("id"), in.Boxes)
		if err != nil {
			return err
		}
		return httpx.OK(w, q)
	}))
	mux.HandleFunc("GET /api/homework/{id}/worksheet", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		data, err := s.Worksheet(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Disposition", `inline; filename="worksheet.pdf"`)
		w.Write(data)
		return nil
	}))
	mux.HandleFunc("PATCH /api/questions/{id}", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var p QuestionPatch
		if err := httpx.Decode(r, &p); err != nil {
			return err
		}
		q, err := s.UpdateQuestion(r.Context(), r.PathValue("id"), p)
		if err != nil {
			return err
		}
		return httpx.OK(w, q)
	}))
	mux.HandleFunc("DELETE /api/questions/{id}", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		if err := s.RemoveQuestion(r.Context(), r.PathValue("id")); err != nil {
			return err
		}
		return httpx.NoContent(w)
	}))
	mux.HandleFunc("POST /api/questions/{id}/retry", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var in Retry
		if err := httpx.Decode(r, &in); err != nil {
			return err
		}
		q, err := s.RetryQuestion(r.Context(), r.PathValue("id"), in)
		if err != nil {
			return err
		}
		return httpx.OK(w, q)
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
		w.Write(data)
		return nil
	}))
}

// assignmentUpload is the file of a multipart upload, read whole: an
// assignment is a few pages, never a textbook.
func assignmentUpload(r *http.Request) (*AssignmentFile, error) {
	mr, err := r.MultipartReader()
	if err != nil {
		return nil, httpx.Invalid("file", "Send the file as a multipart upload.")
	}
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			return nil, httpx.Invalid("file", "No file came with the upload.")
		}
		if err != nil {
			return nil, httpx.Invalid("file", "The upload was cut off.")
		}
		if part.FormName() != "file" {
			continue
		}
		data, err := io.ReadAll(io.LimitReader(part, maxAssignmentBytes+1))
		if err != nil {
			return nil, httpx.Invalid("file", "The upload was cut off.")
		}
		return &AssignmentFile{Name: part.FileName(), Data: data}, nil
	}
}

package library

import (
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/usage"
)

// Routes mounts the library's endpoints.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/books/{id}/usage", httpx.Reply(func(r *http.Request) (*usage.BookUsage, error) {
		return usage.ForBook(r.Context(), s.c.DB, r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/books", httpx.Reply(func(r *http.Request) (Books, error) {
		books, err := s.List(r.Context())
		return Books{Books: books}, err
	}))

	// Upload: multipart, one file per request, streamed straight to disk
	// (a textbook can be hundreds of megabytes).
	mux.HandleFunc("POST /api/books", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		mr, err := r.MultipartReader()
		if err != nil {
			return httpx.Invalid("file", "Send the PDF as a multipart upload.")
		}
		for {
			part, err := mr.NextPart()
			if errors.Is(err, io.EOF) {
				return httpx.Invalid("file", "No file came with the upload.")
			}
			if err != nil {
				return httpx.Invalid("file", "The upload was cut off.")
			}
			if part.FormName() != "file" {
				continue
			}
			b, err := s.Upload(r.Context(), part, part.FileName())
			if err != nil {
				return err
			}
			httpx.JSON(w, http.StatusCreated, BookChanged{Book: b})
			return nil
		}
	}))

	mux.HandleFunc("GET /api/books/{id}", httpx.Reply(func(r *http.Request) (Book, error) {
		return s.Get(r.Context(), r.PathValue("id"))
	}))

	mux.HandleFunc("PATCH /api/books/{id}", httpx.Send(http.StatusOK, func(r *http.Request, p BookPatch) (Book, error) {
		return s.Update(r.Context(), r.PathValue("id"), p)
	}))

	mux.HandleFunc("DELETE /api/books/{id}", httpx.Act(func(r *http.Request) error {
		return s.Remove(r.Context(), r.PathValue("id"))
	}))

	mux.HandleFunc("POST /api/books/{id}/stop", httpx.Reply(func(r *http.Request) (Book, error) {
		return s.Stop(r.Context(), r.PathValue("id"))
	}))

	mux.HandleFunc("POST /api/books/{id}/retry", httpx.Reply(func(r *http.Request) (Book, error) {
		return s.Retry(r.Context(), r.PathValue("id"))
	}))

	mux.HandleFunc("GET /api/books/{id}/contents", httpx.Reply(func(r *http.Request) (Contents, error) {
		return s.Contents(r.Context(), r.PathValue("id"))
	}))

	// A page scan, at about ?w= pixels wide. A book's pages never change
	// under its id, so the browser may keep them for good.
	mux.HandleFunc("GET /api/books/{id}/pages/{n}/image", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		n, err := strconv.Atoi(r.PathValue("n"))
		if err != nil {
			return httpx.NotFound("page")
		}
		width, _ := strconv.Atoi(r.URL.Query().Get("w"))
		if width <= 0 {
			width = 1200
		}
		if _, err := s.Get(r.Context(), r.PathValue("id")); err != nil {
			return err
		}
		data, err := s.PageJPEG(r.Context(), r.PathValue("id"), n, width)
		if errors.Is(err, errNotFound) {
			return httpx.NotFound("page")
		}
		if err != nil {
			return err
		}
		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		httpx.Write(w, data)
		return nil
	}))
}

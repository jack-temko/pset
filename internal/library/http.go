package library

import (
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/jackt/pset/internal/httpx"
)

// Routes mounts the library's endpoints.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/books", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		books, err := s.List(r.Context())
		if err != nil {
			return err
		}
		return httpx.OK(w, Books{Books: books})
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

	mux.HandleFunc("GET /api/books/{id}", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		b, err := s.Get(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		return httpx.OK(w, b)
	}))

	mux.HandleFunc("PATCH /api/books/{id}", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var p BookPatch
		if err := httpx.Decode(r, &p); err != nil {
			return err
		}
		b, err := s.Update(r.Context(), r.PathValue("id"), p)
		if err != nil {
			return err
		}
		return httpx.OK(w, b)
	}))

	mux.HandleFunc("DELETE /api/books/{id}", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		if err := s.Remove(r.Context(), r.PathValue("id")); err != nil {
			return err
		}
		return httpx.NoContent(w)
	}))

	mux.HandleFunc("POST /api/books/{id}/stop", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		b, err := s.Stop(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		return httpx.OK(w, b)
	}))

	mux.HandleFunc("POST /api/books/{id}/retry", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		b, err := s.Retry(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		return httpx.OK(w, b)
	}))

	mux.HandleFunc("GET /api/books/{id}/contents", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		c, err := s.Contents(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		return httpx.OK(w, c)
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
		w.Write(data)
		return nil
	}))
}

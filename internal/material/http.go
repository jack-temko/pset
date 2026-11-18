package material

import (
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
)

// Routes mounts the upload and the reads; adding, renaming and removing are
// actions.
func (s *Service) Routes(mux *http.ServeMux) {
	// Multipart, one file, streamed straight to disk: a textbook can be
	// hundreds of megabytes.
	mux.HandleFunc("POST /api/uploads", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		mr, err := r.MultipartReader()
		if err != nil {
			return httpx.NotMultipart.New().OnField("file")
		}
		for {
			part, err := mr.NextPart()
			if errors.Is(err, io.EOF) {
				return httpx.NoFile.New().OnField("file")
			}
			if err != nil {
				return httpx.UploadCut.Wrap(err).OnField("file")
			}
			if part.FormName() != "file" {
				continue
			}
			u, err := s.Stage(part, part.FileName())
			if err != nil {
				return err
			}
			httpx.JSON(w, http.StatusCreated, u)
			return nil
		}
	}))
	mux.HandleFunc("GET /api/courses/{id}/materials", httpx.Reply(func(r *http.Request) (Materials, error) {
		return s.List(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/materials/{id}", httpx.Reply(func(r *http.Request) (Material, error) {
		return s.Get(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/materials/{id}/contents", httpx.Reply(func(r *http.Request) (Contents, error) {
		return s.Contents(r.Context(), r.PathValue("id"))
	}))
	// A page, at about ?w= pixels wide. A material's pages never change
	// under its id, so the browser may keep them for good.
	mux.HandleFunc("GET /api/materials/{id}/pages/{n}/image", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		n, err := strconv.Atoi(r.PathValue("n"))
		if err != nil {
			return errs.Gone.New("thing", "page")
		}
		width, err := strconv.Atoi(r.URL.Query().Get("w"))
		if err != nil || width <= 0 {
			width = 1200
		}
		data, err := s.PageImage(r.Context(), r.PathValue("id"), n, width)
		if err != nil {
			return err
		}
		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		httpx.Write(w, data)
		return nil
	}))
}

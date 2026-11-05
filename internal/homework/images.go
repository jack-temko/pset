package homework

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	_ "image/png" // registers the PNG decoder for uploaded images
	"strings"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
)

// Images a student attaches to a question, for a figure the book doesn't
// have: a handout's circuit, a graph. Each is stored as a JPEG in
// question_images and listed among the question's figures by its id, so
// the figure route and the worksheet draw it as they do a crop.
const (
	maxImageBytes = 10 << 20
	maxImages     = 6
	maxLabel      = 80
)

var (
	badImage = errs.Define(errs.Entry{
		ID:    "homework.bad_image",
		What:  "That isn't a PNG or JPEG image.",
		Scope: errs.ScopeField,
	})
	imageTooBig = errs.Define(errs.Entry{
		ID:    "homework.image_too_big",
		What:  "Keep the image under {max} MB.",
		Scope: errs.ScopeField,
	})
	tooManyImages = errs.Define(errs.Entry{
		ID:    "homework.too_many_images",
		What:  "A question holds at most {max} images.",
		Scope: errs.ScopeField,
	})
)

// AddImage attaches an uploaded PNG or JPEG to a question as one more
// figure.
func (s *Service) AddImage(ctx context.Context, questionID, label string, data []byte) (Question, error) {
	if len(data) > maxImageBytes {
		return Question{}, imageTooBig.New("max", "10").OnField("file")
	}
	jpg, w, h, err := toJPEG(data)
	if err != nil {
		return Question{}, err
	}
	q, err := getQuestion(ctx, s.c.DB, questionID)
	if errors.Is(err, errNotFound) {
		return Question{}, errs.Gone.New("thing", "question")
	}
	if err != nil {
		return Question{}, err
	}
	var held int
	for _, f := range q.FigRect {
		if f.Image != "" {
			held++
		}
	}
	if held >= maxImages {
		return Question{}, tooManyImages.New("max", "6").OnField("file")
	}
	label = strings.TrimSpace(label)
	if len([]rune(label)) > maxLabel {
		label = string([]rune(label)[:maxLabel])
	}
	id := uuid.NewString()
	figs := append(q.FigRect, figure{Label: label, Image: id, Ratio: float64(h) / float64(w)})
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `INSERT INTO question_images (id, question_id, data) VALUES (?, ?, ?)`, id, questionID, jpg); err != nil {
			return errs.Database.Wrap(err)
		}
		_, err := tx.ExecContext(ctx, `UPDATE questions SET figures = ?, rev = rev + 1, updated_at = ? WHERE id = ?`, mustJSON(figs), db.Now(), questionID)
		return errs.Database.Of(err)
	})
	if err != nil {
		return Question{}, err
	}
	return s.publishQuestion(ctx, questionID)
}

// RemoveFigure takes an attached image off a question. A crop from the
// book isn't the student's to remove.
func (s *Service) RemoveFigure(ctx context.Context, questionID string, n int) (Question, error) {
	q, err := getQuestion(ctx, s.c.DB, questionID)
	if errors.Is(err, errNotFound) {
		return Question{}, errs.Gone.New("thing", "question")
	}
	if err != nil {
		return Question{}, err
	}
	if n < 0 || n >= len(q.FigRect) || q.FigRect[n].Image == "" {
		return Question{}, errs.Gone.New("thing", "figure")
	}
	id := q.FigRect[n].Image
	figs := append(q.FigRect[:n:n], q.FigRect[n+1:]...)
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM question_images WHERE id = ?`, id); err != nil {
			return errs.Database.Wrap(err)
		}
		_, err := tx.ExecContext(ctx, `UPDATE questions SET figures = ?, rev = rev + 1, updated_at = ? WHERE id = ?`, mustJSON(figs), db.Now(), questionID)
		return errs.Database.Of(err)
	})
	if err != nil {
		return Question{}, err
	}
	return s.publishQuestion(ctx, questionID)
}

// imageOf is an attached image's JPEG.
func (s *Service) imageOf(ctx context.Context, id string) ([]byte, error) {
	var data []byte
	err := s.c.DB.QueryRowContext(ctx, `SELECT data FROM question_images WHERE id = ?`, id).Scan(&data)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errs.Gone.New("thing", "figure")
	}
	return data, errs.Database.Of(err)
}

// toJPEG re-encodes an upload as a JPEG on white (a transparent PNG would
// go black), which is what the worksheet's PDF holds, and reports its size.
func toJPEG(data []byte) ([]byte, int, int, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, 0, 0, badImage.Wrap(err).OnField("file")
	}
	b := img.Bounds()
	if b.Dx() == 0 || b.Dy() == 0 {
		return nil, 0, 0, badImage.New().OnField("file")
	}
	flat := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(flat, flat.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.Draw(flat, flat.Bounds(), img, b.Min, draw.Over)
	var out bytes.Buffer
	if err := jpeg.Encode(&out, flat, &jpeg.Options{Quality: 92}); err != nil {
		return nil, 0, 0, badImage.Wrap(err).OnField("file")
	}
	return out.Bytes(), b.Dx(), b.Dy(), nil
}

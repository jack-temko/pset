package library

import (
	"context"

	"github.com/jackt/pset/internal/ocr"
	"github.com/jackt/pset/internal/pdf"
)

// Tools are the external programs the import runs. Tests replace the ones
// a machine may not have (tesseract) or that are slow.
type Tools struct {
	Metadata  func(ctx context.Context, path string) (pdf.Info, error)
	Text      func(ctx context.Context, path string) (string, error)
	XML       func(ctx context.Context, path string) (*pdf.XMLDoc, error)
	OCR       func(ctx context.Context, path string, page int) (string, error)
	PageImage func(ctx context.Context, path string, page, dpi int) ([]byte, error)
}

func LiveTools() Tools {
	return Tools{
		Metadata: pdf.Metadata,
		Text:     pdf.Text,
		XML:      pdf.XML,
		OCR: func(ctx context.Context, path string, page int) (string, error) {
			return ocr.Page(ctx, path, page, "eng")
		},
		PageImage: pdf.PageImage,
	}
}

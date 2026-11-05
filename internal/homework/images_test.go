package homework

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"
)

func testPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for x := range w {
		img.Set(x, 0, color.NRGBA{A: 255})
	}
	var b bytes.Buffer
	if err := png.Encode(&b, img); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

// An attached image is one more figure on a typed question, served at
// the figure route as a JPEG and on the worksheet; removing it takes it
// off, and a non-image is refused.
func TestAnImageAttachesToATypedQuestion(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	qs := e.add(t, h.ID, Draft{Text: "Find i(t).", InBook: false})
	id := qs[0].ID

	if _, err := e.svc.AddImage(t.Context(), id, "", []byte("not an image")); err == nil {
		t.Fatal("a non-image was accepted")
	}
	q, err := e.svc.AddImage(t.Context(), id, " Circuit ", testPNG(t, 40, 20))
	if err != nil {
		t.Fatal(err)
	}
	if len(q.Figures) != 1 || q.Figures[0].Label != "Circuit" || q.Figures[0].Ratio != 0.5 {
		t.Fatalf("figures %+v", q.Figures)
	}
	data, err := e.svc.Figure(t.Context(), id, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, format, err := image.Decode(bytes.NewReader(data)); err != nil || format != "jpeg" {
		t.Fatalf("served %q, %v", format, err)
	}
	if _, err := e.svc.Worksheet(t.Context(), h.ID); err != nil {
		t.Fatal(err)
	}
	q, err = e.svc.RemoveFigure(t.Context(), id, 0)
	if err != nil || len(q.Figures) != 0 {
		t.Fatalf("figures %+v, %v", q.Figures, err)
	}
	if _, err := e.svc.Figure(t.Context(), id, 0); err == nil {
		t.Fatal("a removed image still serves")
	}
}

//go:build llm

// Live homework generation against the real model endpoints. Costs tokens,
// so it sits behind the `llm` build tag. Run with: go test -tags llm ./...
package engine

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/store"
)

// TestLiveHomeworkGeneration drives one staged generation over the digital
// sample: a single pasted question, located and guided by the real model.
func TestLiveHomeworkGeneration(t *testing.T) {
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	book := ingestDigitalSample(t, e, r)

	settings := hwLiveSettings(t)
	if err := e.SaveConfig(context.Background(), settings); err != nil {
		t.Fatal(err)
	}

	hw, job, err := e.SubmitHomework(context.Background(), HomeworkCreate{
		BookSHA256: book.SHA256,
		Title:      "Live smoke",
		SourceText: "Homework: What is a gavel?",
	})
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	runPendingTasks(t, r)

	view, err := e.TaskView(context.Background(), job.ID)
	if err != nil {
		t.Fatal(err)
	}
	if view.Status != store.TaskDone {
		t.Fatalf("job = %s/%s", view.Status, view.Error)
	}
	questions := hwQuestions(t, e, hw.ID)
	if len(questions) != 1 || questions[0].Status != store.QuestionReady {
		t.Fatalf("outline = %s", questionSummaries(questions))
	}
	q := questions[0]
	if q.Page == nil || q.QuestionRect == nil {
		t.Fatalf("pin = page %v rect %+v", q.Page, q.QuestionRect)
	}
	guide := q.Guide
	if guide == nil || guide.Setup == "" || guide.Answer == "" || len(guide.Steps) == 0 {
		t.Fatalf("guide = %+v", guide)
	}
	if strings.Contains(guide.Steps[0], "$$") {
		t.Error("guide steps carry $$ delimiters")
	}

	// The template renders and pdftotext finds the title.
	data, err := e.HomeworkPDF(context.Background(), hw.ID)
	if err != nil {
		t.Fatalf("pdf: %v", err)
	}
	if !strings.Contains(runPdftotext(t, data), "Live smoke") {
		t.Error("pdf lost the title")
	}
}

// hwLiveSettings loads ~/.pset/config.json; skips when absent or keyless.
func hwLiveSettings(t *testing.T) Settings {
	t.Helper()
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skipf("no home directory: %v", err)
	}
	data, err := os.ReadFile(filepath.Join(home, ".pset", "config.json"))
	if err != nil {
		t.Skipf("no ~/.pset/config.json: %v", err)
	}
	var cfg Settings
	if err := json.Unmarshal(data, &cfg); err != nil {
		t.Skipf("config is not valid JSON: %v", err)
	}
	if !cfg.ChatConfigured() {
		t.Skip("no API key in the config")
	}
	return cfg
}

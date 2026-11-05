package homework

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/llm"
)

// crossCheck checks a written guide's final answers against the
// Checker's own solve of the problem, done without the guide. Where they
// differ, the guide is written again once, told which parts to check with
// its tools; where they still differ, a quiet note after the part's
// answer says so. A check that can't run leaves the guide as written.
//
// The Writer's mistakes vary run to run: on 22 hard problems the same
// model on the same inputs got 18 to 20 right, a different few wrong each
// time. On 66 graded guides the Checker's solve caught every wrong one.
func (s *Service) crossCheck(ctx context.Context, m model, book Book, q row, hint, walk []doc.Block) ([]doc.Block, []doc.Block) {
	answers := answerLines(walk)
	if len(answers) == 0 {
		return hint, walk
	}
	s.setActivity(ctx, q.ID, "Checking the answer…")
	// The reading may have been checked while the guide was written.
	if fresh, err := getQuestion(ctx, s.c.DB, q.ID); err == nil {
		q = fresh
	}
	solved, err := s.solveAgain(ctx, m, book, q)
	if err != nil || strings.TrimSpace(solved) == "" {
		slog.Warn("guide: the answer check's solve", "question", q.ID, "err", err)
		return hint, walk
	}
	differ, err := s.compareAnswers(ctx, m, q, answers, solved)
	if err != nil || len(differ) == 0 {
		if err != nil {
			slog.Warn("guide: comparing the answers", "question", q.ID, "err", err)
		}
		return hint, walk
	}
	slog.Info("guide: the answer check differs; writing it again", "question", q.ID, "parts", len(differ))

	s.setActivity(ctx, q.ID, "Rechecking the answer…")
	var b strings.Builder
	b.WriteString("An independent check of an earlier draft of this guide got different final answers here. Check these parts again with the tools before you write them. Where the tools confirm your answer, keep it; where they don't, correct it. The check can be wrong too: go by what the tools give.\n")
	for _, d := range differ {
		fmt.Fprintf(&b, "- %s the draft said %s; the check got %s.\n", partName(d.Label), d.Guide, d.Solve)
	}
	h2, w2, err := s.writeGuide(ctx, m, book, q, b.String())
	if err != nil {
		if ctx.Err() != nil {
			return hint, walk
		}
		slog.Warn("guide: writing it again after the answer check", "question", q.ID, "err", err)
	} else {
		hint, walk = h2, w2
	}

	s.setActivity(ctx, q.ID, "Checking the answer…")
	differ, err = s.compareAnswers(ctx, m, q, answerLines(walk), solved)
	if err != nil || len(differ) == 0 {
		return hint, walk
	}
	slog.Info("guide: the answer check still differs; flagged", "question", q.ID, "parts", len(differ))
	return hint, flagParts(walk, differ)
}

// solveAgain is the Checker's own final answers to the problem, from what
// the guide was written from: the problem, the professor's notes, the
// reading and the figures.
func (s *Service) solveAgain(ctx context.Context, m model, book Book, q row) (string, error) {
	var b strings.Builder
	fmt.Fprintf(&b, "The problem:\n\n%s\n", source(q.Statement))
	b.WriteString(notesText(q))
	if len(q.Reading) > 0 {
		b.WriteString("\nHow the figures read, checked line by line against them:\n" + bullets(sources(q.Reading)))
	}
	content := llm.PartsContent()
	figs := s.figureParts(ctx, book, q)
	if len(figs) > 0 {
		b.WriteString("\nIts figures follow.")
	}
	content.AppendPart(llm.TextPart(b.String()))
	for _, p := range figs {
		content.AppendPart(p)
	}
	return m.client.ChatOnce(ctx, llm.Checker.Ask(llm.ChatRequest{ReasoningEffort: "medium", Messages: []llm.Message{
		llm.TextMessage("system", checkSolvePrompt),
		{Role: "user", Content: content},
	}}))
}

// difference is one part where a guide's final answer and the Checker's
// differ.
type difference struct {
	Label string `json:"label"`
	Guide string `json:"guide"`
	Solve string `json:"solve"`
}

// compareAnswers is where a guide's final answers and the Checker's
// differ, by the Writer at low effort; none when they agree.
func (s *Service) compareAnswers(ctx context.Context, m model, q row, guide []string, solved string) ([]difference, error) {
	if len(guide) == 0 {
		return nil, nil
	}
	user := fmt.Sprintf("The problem:\n\n%s\n\nThe guide's final answers:\n%s\nThe independent solve's final answers:\n%s",
		source(q.Statement), strings.Join(guide, "\n")+"\n", solved)
	reply, err := m.client.ChatOnce(ctx, llm.Writer.Ask(llm.ChatRequest{ReasoningEffort: "low", Messages: []llm.Message{
		llm.TextMessage("system", checkComparePrompt),
		llm.TextMessage("user", user),
	}}))
	if err != nil {
		return nil, err
	}
	var v struct {
		Agree *bool        `json:"agree"`
		Parts []difference `json:"parts"`
	}
	if err := decodeReply(reply, &v); err != nil || v.Agree == nil {
		return nil, fmt.Errorf("unreadable comparison: %q", clip(reply, 200))
	}
	if *v.Agree {
		return nil, nil
	}
	if len(v.Parts) == 0 {
		return []difference{{}}, nil
	}
	return v.Parts, nil
}

// answerLines is a walkthrough's final answers as text, one a part, each
// under its label.
func answerLines(walk []doc.Block) []string {
	var out []string
	for _, a := range doc.Answers(walk) {
		out = append(out, strings.TrimSpace(a.Label+" "+source(a.Text)))
	}
	return out
}

// checkNote is what a guide says under an answer the check still
// disagrees with.
const checkNote = "An independent check got a different answer here; check this step."

// flagParts puts the check's note after the answer of each part that
// still differs: the last answer when a part can't be matched by its
// label.
func flagParts(walk []doc.Block, differ []difference) []doc.Block {
	note, _ := json.Marshal(doc.NoteBlock{Type: doc.TypeNote, Text: []doc.Run{{T: checkNote}}})
	flag := map[int]bool{}
	answers := map[string]int{}
	last := -1
	for i, b := range walk {
		if doc.TypeOf(b) != doc.TypeAnswer {
			continue
		}
		var a doc.AnswerBlock
		cleanup.Log("crosscheck: read an answer block", json.Unmarshal(b, &a))
		answers[sameLabel(a.Label)] = i
		last = i
	}
	for _, d := range differ {
		if i, ok := answers[sameLabel(d.Label)]; ok {
			flag[i] = true
		} else if last >= 0 {
			flag[last] = true
		}
	}
	var out []doc.Block
	for i, b := range walk {
		out = append(out, b)
		if flag[i] {
			out = append(out, note)
		}
	}
	return out
}

// sameLabel is a part's label as compared: "(c)", "c.", "C" are one part.
func sameLabel(label string) string {
	return strings.ToLower(strings.Trim(strings.TrimSpace(label), "()[].: "))
}

// partName is a part as the recheck names it.
func partName(label string) string {
	if l := strings.TrimSpace(label); l != "" {
		return "Part " + l + ":"
	}
	return "The answer:"
}

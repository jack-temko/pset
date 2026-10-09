package homework

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"regexp"
	"strings"

	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/usage"
)

// How hard each question of a set is, against the others in it, 1 to 5:
// what gives a question its share of the set's progress bar, so the bar's
// width left is how much work is left and not how many questions. One
// cheap call sees every statement in the set and scores them together
// (a question is only hard or easy next to the others); without a model,
// or when it answers badly, a heuristic from the statement's length, its
// parts and its figures stands in. Ranking never fails a question and is
// never shown as a failure: a bar with equal segments is what no ranking
// looks like. Spec: web/src/views/homework/grill.md, D31.

// JobRank ranks one set.
const JobRank = "rank"

type rankPayload struct {
	SetID string `json:"setId"`
}

// rankWhenFound queues a ranking of a set once none of its questions is
// left to find (every question is found before any guide is written, so
// the bar is weighted early) and there is at least one. It is called
// wherever that can become true: a find ending or failing, questions
// added, a question removed. One already waiting covers it.
func (s *Service) rankWhenFound(ctx context.Context, setID string) {
	// Two finds ending together both see the set found; one check-and-queue
	// at a time, or both queue a ranking.
	s.rankMu.Lock()
	defer s.rankMu.Unlock()
	var total, finding, waiting int
	if err := s.c.DB.QueryRowContext(ctx, `SELECT count(*), coalesce(sum(in_book = 1 AND state IN ('pending', 'locating')), 0)
		FROM questions WHERE homework_id = ?`, setID).Scan(&total, &finding); err != nil || total == 0 || finding > 0 {
		return
	}
	if err := s.c.DB.QueryRowContext(ctx, `SELECT count(*) FROM jobs WHERE kind = ? AND subject = ? AND state = ?`,
		JobRank, setID, jobs.Queued).Scan(&waiting); err != nil || waiting > 0 {
		return
	}
	if _, err := s.c.Queue.Enqueue(ctx, s.c.DB, jobs.Spec{
		Kind: JobRank, Subject: setID, Key: "rank:" + setID, Priority: locateFirst, Payload: rankPayload{SetID: setID},
	}); err != nil {
		slog.Warn("rank: queue", "set", setID, "err", err)
	}
}

// runRank scores a set's questions and saves what changed. A run stopped
// on shutdown is run again on the next start.
func (s *Service) runRank(ctx context.Context, j jobs.Job) error {
	var p rankPayload
	if err := j.Decode(&p); err != nil {
		return err
	}
	qs, err := listQuestions(ctx, s.c.DB, p.SetID)
	if err != nil {
		return err
	}
	if len(qs) == 0 {
		return nil
	}
	scores, err := s.rank(rankContext(ctx, p.SetID), qs)
	if err != nil {
		return err
	}
	changed := false
	for _, q := range qs {
		d := scores[q.ID]
		if d == q.Difficulty || d == 0 {
			continue
		}
		if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET difficulty = ? WHERE id = ?`, d, q.ID); err != nil {
			return err
		}
		s.publishQuestion(ctx, q.ID)
		changed = true
	}
	if changed {
		s.publishSet(ctx, p.SetID)
	}
	return nil
}

// rank scores each question, by the model when there is one and it
// answers sensibly, else by the heuristic. An error is only ctx's.
func (s *Service) rank(ctx context.Context, qs []Question) (map[string]int, error) {
	if len(qs) == 1 {
		// Hard against what? Alone, it is the middle.
		return map[string]int{qs[0].ID: 3}, nil
	}
	cfg, err := s.c.Settings.LLM(ctx)
	if err == nil && cfg.ChatReady() {
		scores, err := askRank(ctx, llm.Open(cfg), qs)
		if err == nil {
			return scores, nil
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		slog.Warn("rank: model failed, using the heuristic", "err", err)
	}
	return heuristicScores(qs), nil
}

// rankPrompt asks for every question's score against the others.
const rankPrompt = `You rate how hard each question of one homework problem set is, against the others in the set, so a
progress bar can give a hard question more of its width than an easy one. Rate how long and demanding it
is for a student who understands the material: the number of parts, the working each takes (algebra,
setting up a circuit or a figure, several ideas combined), and how much there is to read. Not how
interesting it is.

Reply with only JSON, no prose and no code fence: {"scores": [{"n": 1, "d": 3}, {"n": 2, "d": 5}]}

- n: the question's number in the list. Every question exactly once.
- d: 1 (quick, a step or two) to 5 (the longest and hardest in this set), a whole number.
- Use the range the set has: when the questions differ, the easiest is near 1 and the hardest near 5.
  Questions that are alike get the same number.`

// rankList is the set's questions as the model reads them: a number, the
// label, and the problem's words, cut short, with what makes it longer.
func rankList(qs []Question) string {
	var b strings.Builder
	for i, q := range qs {
		text := source(q.Statement)
		if text == "" {
			text = q.Text
		}
		fmt.Fprintf(&b, "%d. %s\n%s\n", i+1, q.Label, clip(strings.TrimSpace(text), 700))
		if len(q.Figures) > 0 {
			fmt.Fprintf(&b, "(It has %d figure", len(q.Figures))
			if len(q.Figures) > 1 {
				b.WriteString("s")
			}
			b.WriteString(".)\n")
		}
		for _, n := range sources(q.Notes) {
			fmt.Fprintf(&b, "Professor: %s\n", n)
		}
		b.WriteString("\n")
	}
	return strings.TrimSpace(b.String())
}

// askRank asks the Reader, a cheap model, to score the set, and reads its
// answer strictly: every question once, each a whole number from 1 to 5,
// or it is no answer.
func askRank(ctx context.Context, client *llm.Client, qs []Question) (map[string]int, error) {
	reply, err := client.ChatOnce(ctx, llm.Reader.Ask(llm.ChatRequest{ReasoningEffort: "low", Messages: []llm.Message{
		llm.TextMessage("system", rankPrompt),
		llm.TextMessage("user", rankList(qs)),
	}}))
	if err != nil {
		return nil, err
	}
	return parseRank(reply, qs)
}

func parseRank(reply string, qs []Question) (map[string]int, error) {
	var out struct {
		Scores []struct {
			N int     `json:"n"`
			D float64 `json:"d"`
		} `json:"scores"`
	}
	if err := json.Unmarshal([]byte(llm.Unfence(reply)), &out); err != nil {
		return nil, fmt.Errorf("rank: unreadable answer: %w", err)
	}
	scores := map[string]int{}
	for _, s := range out.Scores {
		d := int(math.Round(s.D))
		if s.N < 1 || s.N > len(qs) || d < 1 || d > 5 {
			return nil, fmt.Errorf("rank: out of range (n %d, d %v)", s.N, s.D)
		}
		id := qs[s.N-1].ID
		if _, dup := scores[id]; dup {
			return nil, fmt.Errorf("rank: question %d twice", s.N)
		}
		scores[id] = d
	}
	if len(scores) != len(qs) {
		return nil, fmt.Errorf("rank: %d of %d questions scored", len(scores), len(qs))
	}
	return scores, nil
}

// partMark finds where a part starts in a statement: "(a)", "a)", "a.".
var partMark = regexp.MustCompile(`(?:^|\s)(?:\(?[a-h]\)|[a-h]\.\s)`)

// heuristicRaw is how much a question has in it, before it is set against
// the others: words, parts, figures and math.
func heuristicRaw(q Question) float64 {
	text := source(q.Statement)
	if text == "" {
		text = q.Text
	}
	words := len(strings.Fields(text))
	parts := len(partMark.FindAllString(text, -1))
	maths := min(strings.Count(text, `\(`), 10)
	return float64(words) + 30*float64(parts) + 40*float64(len(q.Figures)) + 4*float64(maths)
}

// heuristicScores sets the questions' raw sizes against each other, the
// smallest a 1 and the largest a 5; all alike is all 3.
func heuristicScores(qs []Question) map[string]int {
	raw := make([]float64, len(qs))
	lo, hi := math.Inf(1), math.Inf(-1)
	for i, q := range qs {
		raw[i] = heuristicRaw(q)
		lo, hi = math.Min(lo, raw[i]), math.Max(hi, raw[i])
	}
	out := make(map[string]int, len(qs))
	for i, q := range qs {
		if hi-lo < 1e-9 {
			out[q.ID] = 3
			continue
		}
		out[q.ID] = 1 + int(math.Round(4*(raw[i]-lo)/(hi-lo)))
	}
	return out
}

// rankContext is the context a set's ranking runs under: its calls are
// the set's, shared among its questions in the usage modal.
func rankContext(ctx context.Context, setID string) context.Context {
	ctx = llm.WithSession(ctx, "rank-"+setID)
	ctx = llm.WithSubject(ctx, llm.Subject{Type: usage.SubjectSet, ID: setID})
	return llm.WithStage(ctx, "Rank")
}

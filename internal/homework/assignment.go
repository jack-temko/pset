package homework

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/jobs"
	"html"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/probnum"
)

// Importing an assignment: a professor's PDF, a course web page, a
// photo, or pasted text, read out into due dates and lines for the
// student to review, then made into sets. Spec: ideas/importing-assignments.md.

// Caps on what an assignment can be.
const (
	maxAssignmentBytes = 20 << 20
	maxAssignmentText  = 60000
	maxGroups          = 40
	maxRows            = 80
	// scanPages is how many pages of a PDF without text are looked at.
	scanPages = 4
)

// AssignmentFile is an uploaded assignment: its name and bytes.
type AssignmentFile struct {
	Name string
	Data []byte
}

// Reading runs in the background, as a job in its own lane, so a
// semester's page on a slow model (minutes) never holds the student in a
// dialog: the read waits in the Homework tab until it's reviewed.
const (
	JobAssignment  = "assignment"
	LaneAssignment = "assignment"
)

// StartRead checks what it's given and starts reading it: from a file, a
// web page, or text, whichever is given. The page itself is fetched by the
// job; only its address is checked here.
func (s *Service) StartRead(ctx context.Context, bookID string, file *AssignmentFile, in AssignmentText) (AssignmentRead, error) {
	if _, err := s.c.Library.Book(ctx, bookID); err != nil {
		return AssignmentRead{}, err
	}
	if in.SetID != "" {
		h, err := getSummary(ctx, s.c.DB, in.SetID)
		if errors.Is(err, errNotFound) || (err == nil && h.BookID != bookID) {
			return AssignmentRead{}, httpx.NotFound("homework set")
		} else if err != nil {
			return AssignmentRead{}, err
		}
	}
	var source, pageURL, text string
	var data []byte
	switch {
	case file != nil:
		if _, err := fileKind(file.Data); err != nil {
			return AssignmentRead{}, err
		}
		source, data = strings.TrimSpace(file.Name), file.Data
		if source == "" {
			source = "file"
		}
	case strings.TrimSpace(in.URL) != "":
		u, err := pageAddress(in.URL)
		if err != nil {
			return AssignmentRead{}, err
		}
		source, pageURL = u.String(), u.String()
	case strings.TrimSpace(in.Text) != "":
		source, text = "pasted", clip(in.Text, maxAssignmentText)
	default:
		return AssignmentRead{}, httpx.Invalid("source", "Give a file, a web page's address, or the assignment's text.")
	}
	id := uuid.NewString()
	now := db.Now()
	err := db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `INSERT INTO assignment_reads (id, book_id, source, set_id, url, text, file, state, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, bookID, source, in.SetID, pageURL, text, data, ReadStateReading, now, now); err != nil {
			return err
		}
		_, err := s.c.Queue.Enqueue(ctx, tx, jobs.Spec{Kind: JobAssignment, Subject: id, Payload: readJob{ReadID: id}})
		return err
	})
	if err != nil {
		return AssignmentRead{}, err
	}
	s.c.Queue.Wake()
	return s.publishRead(ctx, id)
}

// RetryRead reads a failed read again, from what it was given.
func (s *Service) RetryRead(ctx context.Context, id string) (AssignmentRead, error) {
	err := db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `UPDATE assignment_reads SET state = ?, error = '', updated_at = ? WHERE id = ? AND state = ?`,
			ReadStateReading, db.Now(), id, ReadStateFailed)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return httpx.Errorf(httpx.CodeInvalid, "That assignment is already read, or reading.")
		}
		_, err = s.c.Queue.Enqueue(ctx, tx, jobs.Spec{Kind: JobAssignment, Subject: id, Payload: readJob{ReadID: id}})
		return err
	})
	if err != nil {
		var n int
		if s.c.DB.QueryRowContext(ctx, `SELECT count(*) FROM assignment_reads WHERE id = ?`, id).Scan(&n); n == 0 {
			return AssignmentRead{}, httpx.NotFound("assignment")
		}
		return AssignmentRead{}, err
	}
	s.c.Queue.Wake()
	return s.publishRead(ctx, id)
}

type readJob struct {
	ReadID string `json:"readId"`
}

// runAssignmentRead reads one assignment out. A failure is the read's,
// said in a sentence on it; the job itself only fails on a fault.
func (s *Service) runAssignmentRead(ctx context.Context, j jobs.Job) error {
	var p readJob
	if err := j.Decode(&p); err != nil {
		return err
	}
	var bookID, source, pageURL, text string
	var data []byte
	err := s.c.DB.QueryRowContext(ctx, `SELECT book_id, source, url, text, file FROM assignment_reads WHERE id = ?`, p.ReadID).
		Scan(&bookID, &source, &pageURL, &text, &data)
	if errors.Is(err, sql.ErrNoRows) {
		// Dismissed before it started.
		return nil
	} else if err != nil {
		return err
	}
	var content []llm.Part
	switch {
	case data != nil:
		content, err = fileParts(ctx, AssignmentFile{Name: source, Data: data})
	case pageURL != "":
		var page string
		page, err = fetchPage(ctx, pageURL)
		content = []llm.Part{llm.TextPart(page)}
	default:
		content = []llm.Part{llm.TextPart(text)}
	}
	var a Assignment
	if err == nil {
		a, err = s.readOut(ctx, bookID, source, content)
	}
	if err != nil {
		if ctx.Err() != nil {
			// Shutting down or stopped: it's read again on the next start.
			return ctx.Err()
		}
		msg := "Couldn't read it. Try again, or paste just the part with the problems."
		var he *httpx.Error
		if errors.As(err, &he) {
			msg = he.Message
		} else {
			slog.Warn("assignment: read failed", "read", p.ReadID, "err", err)
		}
		return s.settleRead(p.ReadID, ReadStateFailed, msg, nil)
	}
	return s.settleRead(p.ReadID, ReadStateReady, "", &a)
}

// settleRead records how a read ended and says so. On a fresh context:
// the job's may be ending.
func (s *Service) settleRead(id string, state ReadState, msg string, a *Assignment) error {
	ctx := context.Background()
	result := ""
	if a != nil {
		b, err := json.Marshal(a)
		if err != nil {
			return err
		}
		result = string(b)
	}
	// The input is done with once it's read: a PDF needn't sit in the
	// database until the review. A failed one keeps it, to try again.
	res, err := s.c.DB.ExecContext(ctx, `UPDATE assignment_reads SET state = ?, error = ?, result = ?,
		file = CASE WHEN ? = 'ready' THEN NULL ELSE file END, updated_at = ? WHERE id = ?`,
		state, msg, result, state, db.Now(), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil
	}
	_, err = s.publishRead(ctx, id)
	return err
}

// readOut is the model's pass over an assignment: due dates, and each
// line as the book's numbering reads it.
func (s *Service) readOut(ctx context.Context, bookID, source string, content []llm.Part) (Assignment, error) {
	book, err := s.c.Library.Book(ctx, bookID)
	if err != nil {
		return Assignment{}, err
	}
	cfg, err := s.c.Settings.LLM(ctx)
	if err != nil {
		return Assignment{}, err
	}
	if !cfg.ChatReady() {
		return Assignment{}, httpx.Errorf(httpx.CodeInvalid, "There's no chat model set up yet. Add one in Settings, under Connections, then try again.")
	}
	m := model{client: llm.Open(cfg), name: cfg.ChatModel}
	msg := llm.PartsContent(llm.TextPart("The assignment:"))
	for _, p := range content {
		msg.AppendPart(p)
	}
	reply, err := m.client.ChatOnce(ctx, llm.ChatRequest{Model: m.name, Messages: []llm.Message{
		llm.TextMessage("system", assignmentBrief(book, time.Now())),
		{Role: "user", Content: msg},
	}})
	if err != nil {
		if ctx.Err() != nil {
			return Assignment{}, ctx.Err()
		}
		trouble, status := llm.Classify(err)
		if trouble == llm.TroubleRejected {
			return Assignment{}, httpx.Errorf(httpx.CodeInvalid, "%s Check the chat connection in Settings, then try again.", llm.Refusal(status))
		}
		return Assignment{}, httpx.Errorf(httpx.CodeInvalid, "Your chat model provider didn't answer while reading the assignment. Try again in a minute.")
	}
	var read struct {
		Title  string `json:"title"`
		Groups []struct {
			Due   string `json:"due"`
			Title string `json:"title"`
			Rows  []struct {
				Kind RowKind `json:"kind"`
				Text string  `json:"text"`
			} `json:"rows"`
		} `json:"groups"`
	}
	if err := json.Unmarshal([]byte(llm.Unfence(reply)), &read); err != nil {
		slog.Warn("assignment: reply wasn't JSON", "err", err)
		return Assignment{}, httpx.Errorf(httpx.CodeInvalid, "Couldn't make out the assignment's homework. Try again, or paste just the part with the problems.")
	}

	out := Assignment{Source: source, Title: strings.TrimSpace(read.Title), Groups: []AssignmentGroup{}}
	for _, g := range read.Groups {
		if len(out.Groups) == maxGroups {
			break
		}
		due, _ := cleanDate(g.Due)
		group := AssignmentGroup{Due: due, Title: strings.TrimSpace(g.Title), Rows: []AssignmentRow{}, Gone: []SetQuestion{}}
		for _, r := range g.Rows {
			text := strings.TrimSpace(r.Text)
			if text == "" || len(group.Rows) == maxRows {
				continue
			}
			row := AssignmentRow{Kind: r.Kind, Text: text, Labels: []string{}, Notes: []string{}, Present: []string{}, Changed: []NotesChange{}}
			switch r.Kind {
			case RowKindBook:
				row.Labels, row.Notes, row.Unread = readLine(text, book.Problems)
			case RowKindOwn, RowKindOther:
			default:
				row.Kind = RowKindOther
			}
			group.Rows = append(group.Rows, row)
		}
		if len(group.Rows) > 0 {
			out.Groups = append(out.Groups, group)
		}
	}
	if len(out.Groups) == 0 {
		return Assignment{}, httpx.Errorf(httpx.CodeInvalid, "Didn't find any homework in it. If it's there, paste just that part.")
	}
	for i, g := range out.Groups {
		if g.Title == "" {
			out.Groups[i].Title = defaultTitle(out.Title, g.Due, len(out.Groups) > 1)
		}
	}
	return out, nil
}

// readLine is a book line as the questions it becomes, in the book's
// numbering, and the notes they carry; unread when it isn't a reference
// the book's numbering can place.
func readLine(text string, style probnum.Style) (labels, notes []string, unread bool) {
	labels, notes = []string{}, []string{}
	for _, row := range splitDraft(Draft{Text: text, InBook: true}, style) {
		labels = append(labels, row.label)
		for _, n := range row.notes {
			if !slices.Contains(notes, n) {
				notes = append(notes, n)
			}
		}
	}
	_, ok := ParseRefs(text, style)
	if !ok {
		return []string{}, []string{}, true
	}
	return labels, notes, false
}

// defaultTitle names a set without a title of its own. One date's sheet
// is the document's name ("Assignment #3"); a semester's table names
// every date the same, so there it's when it's due, which is what tells
// the sets apart.
func defaultTitle(doc, due string, several bool) string {
	t, err := time.Parse("2006-01-02", due)
	switch {
	case doc != "" && !several:
		return doc
	case err == nil:
		return "Homework due " + t.Format("Jan 2")
	case doc != "":
		return doc
	}
	return "Homework"
}

// ImportAssignment makes each group the student kept into a set, its
// lines into questions, as Add does; a group that updates a set applies
// its changes to that set instead. The read they came from is done with.
func (s *Service) ImportAssignment(ctx context.Context, bookID string, in AssignmentImport) ([]Summary, error) {
	if len(in.Groups) == 0 {
		return nil, httpx.Invalid("groups", "Pick at least one due date to add.")
	}
	book, err := s.c.Library.Book(ctx, bookID)
	if err != nil {
		return nil, err
	}
	var out []Summary
	for _, g := range in.Groups {
		if g.SetID != "" {
			h, err := getSummary(ctx, s.c.DB, g.SetID)
			if errors.Is(err, errNotFound) || (err == nil && h.BookID != bookID) {
				return nil, httpx.NotFound("homework set")
			} else if err != nil {
				return nil, err
			}
			changed, err := s.updateSet(ctx, g, book.Problems)
			if err != nil {
				return nil, err
			}
			if !changed {
				continue
			}
			// A set updated from a document it didn't come from is checked
			// against that document from now on.
			if _, err := s.c.DB.ExecContext(ctx, `UPDATE homework SET source = ? WHERE id = ? AND source = ''`, in.Source, g.SetID); err != nil {
				return nil, err
			}
			if h, err = s.publishSet(ctx, g.SetID); err != nil {
				return nil, err
			}
			out = append(out, h)
			continue
		}
		var rows []Draft
		for _, r := range g.Rows {
			if strings.TrimSpace(r.Text) != "" {
				rows = append(rows, r)
			}
		}
		if len(rows) == 0 {
			continue
		}
		h, err := s.Create(ctx, bookID, Input{Title: g.Title, DueDate: g.Due})
		if err != nil {
			return nil, err
		}
		if _, err := s.c.DB.ExecContext(ctx, `UPDATE homework SET source = ? WHERE id = ?`, in.Source, h.ID); err != nil {
			return nil, err
		}
		if _, err := s.Add(ctx, h.ID, rows); err != nil {
			return nil, err
		}
		if h, err = s.publishSet(ctx, h.ID); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	if len(out) == 0 {
		return nil, httpx.Invalid("groups", "There's nothing left to add or change in those.")
	}
	if in.ReadID != "" {
		if err := s.DismissRead(ctx, in.ReadID); err != nil && !isNotFound(err) {
			return nil, err
		}
	}
	return out, nil
}

// LastSource is the web page the book's assignments were last read
// from, for checking again.
func (s *Service) LastSource(ctx context.Context, bookID string) (AssignmentSource, error) {
	var src string
	err := s.c.DB.QueryRowContext(ctx, `SELECT source FROM homework WHERE book_id = ? AND (source LIKE 'http://%' OR source LIKE 'https://%')
		ORDER BY created_at DESC LIMIT 1`, bookID).Scan(&src)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return AssignmentSource{}, err
	}
	return AssignmentSource{URL: src}, nil
}

// fileParts is an uploaded file as what the model reads: a PDF's text,
// or its pages as images when it has none; a photo as itself.
func fileParts(ctx context.Context, f AssignmentFile) ([]llm.Part, error) {
	kind, err := fileKind(f.Data)
	if err != nil {
		return nil, err
	}
	switch {
	case kind == "application/pdf":
		dir, err := os.MkdirTemp("", "pset-assignment-*")
		if err != nil {
			return nil, err
		}
		defer os.RemoveAll(dir)
		path := filepath.Join(dir, "a.pdf")
		if err := os.WriteFile(path, f.Data, 0o600); err != nil {
			return nil, err
		}
		text, err := pdf.Text(ctx, path)
		if err != nil {
			return nil, httpx.Invalid("file", "That PDF couldn't be read.")
		}
		if len(strings.TrimSpace(strings.ReplaceAll(text, "\f", ""))) > 40 {
			return []llm.Part{llm.TextPart(clip(text, maxAssignmentText))}, nil
		}
		// A scan: its first pages, as images.
		var parts []llm.Part
		for n := 1; n <= scanPages; n++ {
			img, err := pdf.PageImage(ctx, path, n, 150)
			if err != nil {
				break
			}
			parts = append(parts, llm.ImagePart("data:image/jpeg;base64,"+base64.StdEncoding.EncodeToString(img)))
		}
		if len(parts) == 0 {
			return nil, httpx.Invalid("file", "That PDF couldn't be read.")
		}
		return parts, nil
	case strings.HasPrefix(kind, "image/"):
		return []llm.Part{llm.ImagePart("data:" + kind + ";base64," + base64.StdEncoding.EncodeToString(f.Data))}, nil
	}
	return []llm.Part{llm.TextPart(clip(string(f.Data), maxAssignmentText))}, nil
}

// fileKind is what an uploaded file is, if it's one PSet reads: a PDF,
// an image, or text.
func fileKind(data []byte) (string, error) {
	if len(data) > maxAssignmentBytes {
		return "", httpx.Invalid("file", "That file is too big for an assignment.")
	}
	kind := http.DetectContentType(data)
	if kind == "application/pdf" || strings.HasPrefix(kind, "image/") || strings.HasPrefix(kind, "text/") {
		return kind, nil
	}
	return "", httpx.Invalid("file", "Send a PDF, a photo, or a text file.")
}

// fetchPage is a course web page as text, its tables kept as rows.
func fetchPage(ctx context.Context, raw string) (string, error) {
	u, err := pageAddress(raw)
	if err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if err != nil {
		return "", httpx.Invalid("url", "That isn't a web page's address.")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", httpx.Invalid("url", "Couldn't reach that page.")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", httpx.Invalid("url", "That page answered %d. A page behind a login can be pasted or photographed instead.", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxAssignmentBytes))
	if err != nil {
		return "", httpx.Invalid("url", "Couldn't read that page.")
	}
	text := htmlText(string(body))
	if strings.TrimSpace(text) == "" {
		return "", httpx.Invalid("url", "That page has no text to read.")
	}
	return clip(text, maxAssignmentText), nil
}

// pageAddress is a web page's address, if it is one PSet fetches: http
// or https, with a host.
func pageAddress(raw string) (*url.URL, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return nil, httpx.Invalid("url", "That isn't a web page's address.")
	}
	return u, nil
}

var (
	htmlDrop   = regexp.MustCompile(`(?is)<(script|style|head)[^>]*>.*?</(script|style|head)>`)
	htmlRow    = regexp.MustCompile(`(?i)<tr[^>]*>`)
	htmlRowEnd = regexp.MustCompile(`(?i)</tr>`)
	htmlBreak  = regexp.MustCompile(`(?i)<br\s*/?>|</p>|</div>|</li>|</h[1-6]>`)
	htmlCell   = regexp.MustCompile(`(?i)</t[dh]>`)
	htmlTag    = regexp.MustCompile(`<[^>]+>`)
	htmlSpaces = regexp.MustCompile(`[ \t\x{a0}]+`)
	htmlInRow  = regexp.MustCompile(`\x01([^\x02]*)\x02`)
	htmlBlank  = regexp.MustCompile(`\n\s*\n+`)
)

// htmlText is a page's text with each table row on one line and its cells
// split by " | ", which is how a semester table reads: a row a lecture,
// one cell its due date, another its problems. A cell's text spread over
// several lines of source comes back together.
func htmlText(page string) string {
	page = htmlDrop.ReplaceAllString(page, "")
	page = htmlRow.ReplaceAllString(page, "\x01")
	page = htmlRowEnd.ReplaceAllString(page, "\x02")
	page = htmlCell.ReplaceAllString(page, " | ")
	page = htmlBreak.ReplaceAllString(page, "\n")
	page = htmlTag.ReplaceAllString(page, "")
	page = html.UnescapeString(page)
	page = htmlInRow.ReplaceAllStringFunc(page, func(row string) string {
		row = strings.Trim(row, "\x01\x02")
		return "\n" + strings.TrimSuffix(strings.TrimSpace(strings.Join(strings.Fields(row), " ")), "|") + "\n"
	})
	page = strings.NewReplacer("\x01", "", "\x02", "").Replace(page)
	var lines []string
	for _, l := range strings.Split(page, "\n") {
		lines = append(lines, strings.TrimSpace(htmlSpaces.ReplaceAllString(l, " ")))
	}
	return strings.TrimSpace(htmlBlank.ReplaceAllString(strings.Join(lines, "\n"), "\n"))
}

// assignmentBrief is the reading prompt, with today's date, for the
// year a sheet leaves out, and how this book numbers its problems, for
// keeping its references whole.
func assignmentBrief(book Book, now time.Time) string {
	style := "problems are numbered like 4.27"
	switch book.Problems.Form {
	case probnum.FormLocal:
		style = `problems start again in each section, so a reference names the section and the number ("2.1: 1, 4" or "3.1 #7")`
	case probnum.FormSection:
		style = `problems are numbered like 2.1.4 (section, then problem)`
	}
	return fmt.Sprintf(assignmentPrompt, now.Format("Monday, January 2, 2006"), book.Title, style)
}

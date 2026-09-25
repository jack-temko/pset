package homework

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
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

// ReadAssignment reads an assignment out for review: from a file, a web
// page, or text, whichever is given.
func (s *Service) ReadAssignment(ctx context.Context, bookID string, file *AssignmentFile, in AssignmentText) (Assignment, error) {
	book, err := s.c.Library.Book(ctx, bookID)
	if err != nil {
		return Assignment{}, err
	}
	var content []llm.Part
	var source string
	switch {
	case file != nil:
		source = file.Name
		content, err = fileParts(ctx, *file)
	case strings.TrimSpace(in.URL) != "":
		source = strings.TrimSpace(in.URL)
		var text string
		text, err = fetchPage(ctx, source)
		content = []llm.Part{llm.TextPart(text)}
	case strings.TrimSpace(in.Text) != "":
		source = "pasted"
		content = []llm.Part{llm.TextPart(clip(in.Text, maxAssignmentText))}
	default:
		return Assignment{}, httpx.Invalid("source", "Give a file, a web page's address, or the assignment's text.")
	}
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
	imported, err := s.importedDates(ctx, bookID, source)
	if err != nil {
		return Assignment{}, err
	}
	for _, g := range read.Groups {
		if len(out.Groups) == maxGroups {
			break
		}
		due, _ := cleanDate(g.Due)
		group := AssignmentGroup{Due: due, Title: strings.TrimSpace(g.Title), Rows: []AssignmentRow{}, Imported: due != "" && imported[due]}
		for _, r := range g.Rows {
			text := strings.TrimSpace(r.Text)
			if text == "" || len(group.Rows) == maxRows {
				continue
			}
			row := AssignmentRow{Kind: r.Kind, Text: text, Labels: []string{}, Notes: []string{}}
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

// importedDates is the due dates already made into sets from a source.
func (s *Service) importedDates(ctx context.Context, bookID, source string) (map[string]bool, error) {
	out := map[string]bool{}
	rows, err := s.c.DB.QueryContext(ctx, `SELECT due_date FROM homework WHERE book_id = ? AND source = ? AND due_date != ''`, bookID, source)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		out[d] = true
	}
	return out, rows.Err()
}

// ImportAssignment makes each group the student kept into a set, its
// lines into questions, as Add does.
func (s *Service) ImportAssignment(ctx context.Context, bookID string, in AssignmentImport) ([]Summary, error) {
	if len(in.Groups) == 0 {
		return nil, httpx.Invalid("groups", "Pick at least one due date to add.")
	}
	var out []Summary
	for _, g := range in.Groups {
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
		h, err = s.publishSet(ctx, h.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	if len(out) == 0 {
		return nil, httpx.Invalid("groups", "None of those has a question left in it.")
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
	if len(f.Data) > maxAssignmentBytes {
		return nil, httpx.Invalid("file", "That file is too big for an assignment.")
	}
	kind := http.DetectContentType(f.Data)
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
	case strings.HasPrefix(kind, "text/"):
		return []llm.Part{llm.TextPart(clip(string(f.Data), maxAssignmentText))}, nil
	}
	return nil, httpx.Invalid("file", "Send a PDF, a photo, or a text file.")
}

// fetchPage is a course web page as text, its tables kept as rows.
func fetchPage(ctx context.Context, raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", httpx.Invalid("url", "That isn't a web page's address.")
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

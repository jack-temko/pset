// Command assignmenttest measures reading assignments against made-up
// lookalikes of Jack's professors' documents and harder ones built to
// stress it (docs.go): each is read by a running PSet, with its real chat
// model, and the reading scored against what the document says: its due
// dates, the problems due on each in the book's labels, the professor's
// notes, and the problems written out. Web pages are served from here,
// so the server fetches them as it would a course page; PDFs are built
// here too. Reads are dismissed afterwards, so nothing is added.
// Spec: ideas/finder-tests.md.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"mime/multipart"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
)

type row struct {
	Kind   string   `json:"kind"`
	Text   string   `json:"text"`
	Labels []string `json:"labels"`
	Notes  []string `json:"notes"`
	Unread bool     `json:"unread"`
}

type group struct {
	Due   string `json:"due"`
	Title string `json:"title"`
	Rows  []row  `json:"rows"`
}

type read struct {
	ID         string `json:"id"`
	State      string `json:"state"`
	Error      string `json:"error"`
	Assignment *struct {
		Title  string  `json:"title"`
		Groups []group `json:"groups"`
	} `json:"assignment"`
}

func main() {
	addr := flag.String("addr", "http://127.0.0.1:8420", "the running PSet")
	only := flag.String("doc", "", "only the documents whose name contains this")
	out := flag.String("out", "", "also write each document here, to look at")
	keep := flag.Bool("keep", false, "leave the reads in the Homework list, to review in the app")
	wait := flag.Duration("wait", 20*time.Minute, "how long to wait for every read")
	flag.Parse()

	var books struct {
		Books []struct{ ID, Title string }
	}
	if err := call(*addr, "GET", "/api/books", nil, &books); err != nil {
		fatal("books: %v", err)
	}
	bookID := map[string]string{}
	for _, b := range books.Books {
		bookID[b.Title] = b.ID
	}

	// The web pages, served to the server as a course site would be.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fatal("serve: %v", err)
	}
	pages := http.NewServeMux()
	for _, d := range docs {
		if d.HTML != "" {
			html := d.HTML
			pages.HandleFunc("/"+d.Name+".htm", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "text/html")
				fmt.Fprint(w, html)
			})
		}
	}
	go http.Serve(ln, pages)
	site := "http://" + ln.Addr().String()

	type run struct {
		d     doc
		id    string
		start time.Time
		r     read
		err   string
	}
	var runs []*run
	for _, d := range docs {
		if *only != "" && !strings.Contains(d.Name, *only) {
			continue
		}
		id, ok := bookID[d.Book]
		if !ok {
			fmt.Printf("%s: %s isn't in the library, skipped\n", d.Name, d.Book)
			continue
		}
		rn := &run{d: d, start: time.Now()}
		var r read
		switch {
		case d.PDF != nil:
			data, err := d.PDF()
			if err != nil {
				fatal("%s: %v", d.Name, err)
			}
			if *out != "" {
				os.WriteFile(filepath.Join(*out, d.Name+".pdf"), data, 0o644)
			}
			err = upload(*addr, id, d.Name+".pdf", data, &r)
			if err != nil {
				rn.err = err.Error()
			}
		case d.HTML != "":
			if *out != "" {
				os.WriteFile(filepath.Join(*out, d.Name+".htm"), []byte(d.HTML), 0o644)
			}
			if err := call(*addr, "POST", "/api/books/"+id+"/assignments/read", map[string]string{"url": site + "/" + d.Name + ".htm"}, &r); err != nil {
				rn.err = err.Error()
			}
		default:
			if err := call(*addr, "POST", "/api/books/"+id+"/assignments/read", map[string]string{"text": d.Text}, &r); err != nil {
				rn.err = err.Error()
			}
		}
		rn.id = r.ID
		runs = append(runs, rn)
	}
	fmt.Printf("reading %d documents…\n\n", len(runs))

	// Every read runs at once (the server takes two at a time); wait for
	// them all.
	var wg sync.WaitGroup
	deadline := time.Now().Add(*wait)
	for _, rn := range runs {
		if rn.err != "" {
			continue
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				var r read
				if err := call(*addr, "GET", "/api/assignment-reads/"+rn.id, nil, &r); err != nil {
					rn.err = err.Error()
					return
				}
				rn.r = r
				if r.State != "reading" || time.Now().After(deadline) {
					if !*keep {
						call(*addr, "DELETE", "/api/assignment-reads/"+rn.id, nil, nil)
					}
					return
				}
				time.Sleep(3 * time.Second)
			}
		}()
	}
	wg.Wait()

	right, dates, datesRight := 0, 0, 0
	for _, rn := range runs {
		took := time.Since(rn.start).Round(time.Second)
		fmt.Printf("%s · %s · %s\n  %s\n", rn.d.Name, rn.d.Book, kindOf(rn.d), rn.d.About)
		var lines []string
		ok := true
		switch {
		case rn.err != "":
			ok = false
			lines = append(lines, "FAIL   couldn't read it: "+rn.err)
		case rn.d.NoHomework:
			if rn.r.State == "failed" || countWork(rn.r) == 0 {
				lines = append(lines, "ok     nothing to assign, and nothing read")
			} else {
				ok = false
				lines = append(lines, fmt.Sprintf("FAIL   read %d problems from a document with none", countWork(rn.r)))
			}
		case rn.r.State == "reading":
			ok = false
			lines = append(lines, "FAIL   still reading after "+wait.String())
		case rn.r.State == "failed":
			ok = false
			lines = append(lines, "FAIL   "+rn.r.Error)
		default:
			var ls []string
			var good int
			good, ls = score(rn.d, rn.r)
			dates += len(rn.d.Want)
			datesRight += good
			ok = good == len(rn.d.Want) && !slices.ContainsFunc(ls, func(l string) bool { return !strings.HasPrefix(l, "ok") })
			lines = append(lines, ls...)
		}
		if ok {
			right++
		}
		for _, l := range lines {
			fmt.Println("  " + l)
		}
		fmt.Printf("  (%s)\n\n", took)
	}
	fmt.Printf("%d of %d documents read right; %d of %d due dates right\n", right, len(runs), datesRight, dates)
	if right < len(runs) {
		os.Exit(1)
	}
}

// score compares a reading with what the document says: a line per due
// date, and one for any date read that the document doesn't give.
func score(d doc, r read) (good int, lines []string) {
	byDue := map[string][]group{}
	for _, g := range r.Assignment.Groups {
		byDue[g.Due] = append(byDue[g.Due], g)
	}
	for _, w := range d.Want {
		gs := byDue[w.Due]
		delete(byDue, w.Due)
		if len(gs) == 0 {
			lines = append(lines, fmt.Sprintf("MISS   %s  not read as a due date", w.Due))
			continue
		}
		labels := map[string]bool{}
		notes := map[string]string{}
		own := 0
		var unread []string
		for _, g := range gs {
			for _, rw := range g.Rows {
				switch rw.Kind {
				case "book":
					if rw.Unread {
						unread = append(unread, rw.Text)
					}
					for _, l := range rw.Labels {
						labels[l] = true
						notes[l] += " " + strings.Join(rw.Notes, "; ")
					}
				case "own":
					own++
				}
			}
		}
		var faults []string
		var missing, extra []string
		for _, l := range w.Labels {
			if !labels[l] {
				missing = append(missing, l)
			}
		}
		for l := range labels {
			if !slices.Contains(w.Labels, l) {
				extra = append(extra, l)
			}
		}
		sort.Strings(extra)
		if len(missing) > 0 {
			faults = append(faults, "missing "+strings.Join(missing, ", "))
		}
		if len(extra) > 0 {
			faults = append(faults, "extra "+strings.Join(extra, ", "))
		}
		for l, phrase := range w.Notes {
			// Math may come back as LaTeX: "in terms of $q$" says "terms of q".
			said := strings.NewReplacer("$", "", "\\", "").Replace(strings.ToLower(notes[l]))
			if labels[l] && !strings.Contains(said, strings.ToLower(phrase)) {
				faults = append(faults, fmt.Sprintf("%s's notes lack %q (%q)", l, phrase, strings.TrimSpace(notes[l])))
			}
		}
		if own != w.Own {
			faults = append(faults, fmt.Sprintf("%d written-out problems, want %d", own, w.Own))
		}
		for _, u := range unread {
			faults = append(faults, fmt.Sprintf("unreadable line %q", clip(u, 60)))
		}
		if len(faults) == 0 {
			good++
			lines = append(lines, fmt.Sprintf("ok     %s  %d problems%s", w.Due, len(w.Labels), ownNote(w.Own)))
		} else {
			lines = append(lines, fmt.Sprintf("WRONG  %s  %s", w.Due, strings.Join(faults, "; ")))
		}
	}
	var rest []string
	for due, gs := range byDue {
		if slices.Contains(d.Maybe, due) {
			continue
		}
		n := 0
		for _, g := range gs {
			n += countRows(g)
		}
		if n > 0 {
			rest = append(rest, fmt.Sprintf("EXTRA  %s  %d lines of homework on a date the document doesn't give", orNone(due), n))
		}
	}
	sort.Strings(rest)
	return good, append(lines, rest...)
}

func countRows(g group) int {
	n := 0
	for _, r := range g.Rows {
		if r.Kind != "other" {
			n++
		}
	}
	return n
}

func countWork(r read) int {
	if r.Assignment == nil {
		return 0
	}
	n := 0
	for _, g := range r.Assignment.Groups {
		n += countRows(g)
	}
	return n
}

func kindOf(d doc) string {
	switch {
	case d.PDF != nil:
		return "PDF"
	case d.HTML != "":
		return "web page"
	}
	return "pasted text"
}

func ownNote(n int) string {
	if n == 0 {
		return ""
	}
	return fmt.Sprintf(", %d written out", n)
}

func orNone(due string) string {
	if due == "" {
		return "(no date)"
	}
	return due
}

func clip(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func upload(addr, bookID, name string, data []byte, out any) error {
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("file", name)
	fw.Write(data)
	mw.Close()
	resp, err := http.Post(addr+"/api/books/"+bookID+"/assignments/read", mw.FormDataContentType(), &body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		var e struct{ Message string }
		json.NewDecoder(resp.Body).Decode(&e)
		return fmt.Errorf("%d: %s", resp.StatusCode, e.Message)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func call(addr, method, path string, body, out any) error {
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req, err := http.NewRequest(method, addr+path, &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		var e struct{ Message string }
		json.NewDecoder(resp.Body).Decode(&e)
		return fmt.Errorf("%s %s: %d: %s", method, path, resp.StatusCode, e.Message)
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(2)
}

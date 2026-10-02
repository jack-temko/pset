// Command findertest measures the finder against Jack's books: for each
// book in cases.json it makes a homework set, adds the references, waits
// for each to be found, compares the page with the known answer, and
// removes the set, so no guide is written. It drives a running PSet over
// HTTP, so it tests the real thing, model calls included (each find costs
// one to three). Spec: ideas/finder-tests.md.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

type cases struct {
	Books []struct {
		Title  string `json:"title"`
		SHA256 string `json:"sha256"`
		Cases  []struct {
			Text string         `json:"text"`
			Want map[string]int `json:"want"`
		} `json:"cases"`
	} `json:"books"`
}

type book struct {
	ID       string `json:"id"`
	SHA256   string `json:"sha256"`
	Title    string `json:"title"`
	PageRuns []struct {
		From   int `json:"from"`
		Offset int `json:"offset"`
	} `json:"pageRuns"`
}

type question struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Text   string `json:"text"`
	Page   *int   `json:"page"`
	State  string `json:"state"`
	Reason string `json:"reason"`
}

func main() {
	addr := flag.String("addr", "http://127.0.0.1:8420", "the running PSet")
	file := flag.String("cases", "tools/findertest/cases.json", "the cases")
	only := flag.String("book", "", "only the book whose title contains this")
	wait := flag.Duration("wait", 20*time.Minute, "how long to wait for every find")
	flag.Parse()

	var cs cases
	data, err := os.ReadFile(*file)
	if err == nil {
		err = json.Unmarshal(data, &cs)
	}
	if err != nil {
		fatal("cases: %v", err)
	}
	var books struct{ Books []book }
	if err := call(*addr, "GET", "/api/books", nil, &books); err != nil {
		fatal("books: %v", err)
	}

	misses, total := 0, 0
	for _, want := range cs.Books {
		if *only != "" && !strings.Contains(want.Title, *only) {
			continue
		}
		var b *book
		for i := range books.Books {
			if books.Books[i].Title == want.Title {
				b = &books.Books[i]
			}
		}
		if b == nil {
			fmt.Printf("%s: not in the library, skipped\n", want.Title)
			continue
		}
		if !strings.HasPrefix(b.SHA256, want.SHA256) {
			fmt.Printf("%s: a different scan than the cases were written for (%s); pages may not match\n", want.Title, b.SHA256[:16])
		}
		var set struct{ ID string }
		if err := call(*addr, "POST", "/api/books/"+b.ID+"/homework", map[string]string{"title": "Finder test " + time.Now().Format("15:04")}, &set); err != nil {
			fatal("new set: %v", err)
		}
		type draft struct {
			Text   string `json:"text"`
			InBook bool   `json:"inBook"`
		}
		var drafts []draft
		expect := map[string]int{}
		for _, c := range want.Cases {
			drafts = append(drafts, draft{c.Text, true})
			for l, p := range c.Want {
				expect[l] = p
			}
		}
		var added struct{ Questions []question }
		if err := call(*addr, "POST", "/api/homework/"+set.ID+"/questions", map[string]any{"drafts": drafts}, &added); err != nil {
			fatal("add: %v", err)
		}
		fmt.Printf("%s: %d references, %d questions\n", want.Title, len(drafts), len(added.Questions))

		deadline := time.Now().Add(*wait)
		var qs []question
		for {
			var detail struct{ Questions []question }
			if err := call(*addr, "GET", "/api/homework/"+set.ID, nil, &detail); err != nil {
				fatal("poll: %v", err)
			}
			qs = detail.Questions
			done := 0
			for _, q := range qs {
				if q.Page != nil || q.State == "failed" {
					done++
				}
			}
			if done == len(qs) || time.Now().After(deadline) {
				break
			}
			time.Sleep(3 * time.Second)
		}
		// Found is all this measures: the guides stop with the set.
		call(*addr, "DELETE", "/api/homework/"+set.ID, nil, nil)

		printed := func(pdf int) int {
			off := 0
			for _, r := range b.PageRuns {
				if r.From <= pdf {
					off = r.Offset
				}
			}
			return pdf - off
		}
		sort.SliceStable(qs, func(i, j int) bool { return qs[i].Label < qs[j].Label })
		seen := map[string]bool{}
		for _, q := range qs {
			total++
			seen[q.Label] = true
			exp, known := expect[q.Label]
			switch {
			case !known:
				misses++
				fmt.Printf("  ?     %-10s read as a label the cases don't have (%q)\n", q.Label, q.Text)
			case q.Page == nil:
				misses++
				fmt.Printf("  MISS  %-10s want PDF %d (p. %d): %s\n", q.Label, exp, printed(exp), firstLine(q.Reason, q.State))
			case *q.Page != exp:
				misses++
				fmt.Printf("  WRONG %-10s got PDF %d (p. %d), want PDF %d (p. %d)\n", q.Label, *q.Page, printed(*q.Page), exp, printed(exp))
			default:
				fmt.Printf("  ok    %-10s PDF %d (p. %d)\n", q.Label, *q.Page, printed(*q.Page))
			}
		}
		for l := range expect {
			if !seen[l] {
				misses++
				total++
				fmt.Printf("  LOST  %-10s no question was read as this\n", l)
			}
		}
	}
	fmt.Printf("\n%d of %d found where they should be\n", total-misses, total)
	if misses > 0 {
		os.Exit(1)
	}
}

func firstLine(s, state string) string {
	if s == "" {
		return "still " + state
	}
	return strings.SplitN(s, "\n", 2)[0]
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
		return fmt.Errorf("%s %s: %d %s", method, path, resp.StatusCode, e.Message)
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "findertest: "+format+"\n", args...)
	os.Exit(2)
}

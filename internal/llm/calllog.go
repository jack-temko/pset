package llm

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// The call log: every chat request and what came back, the model's
// reasoning included, one JSON object per line, so a bad or slow
// walkthrough can be traced to its exact prompt and thinking. Images
// are replaced by a placeholder; they would make the log unreadable and
// huge. The file rolls over at logMax, keeping one previous file.
const logMax = 20 << 20

var callLog struct {
	sync.Mutex
	path string
	// sink, when set, is handed every finished call: the usage store's
	// writer, supplied by the db side (main.go). Nil stops it. The JSONL
	// log keeps writing either way.
	sink func(Call)
}

// OnCall sets the sink every finished call is handed to; nil stops it.
func OnCall(fn func(Call)) {
	callLog.Lock()
	defer callLog.Unlock()
	callLog.sink = fn
}

// Call is one finished model call, as the usage store records it: what it
// was for (the job's Subject), who answered, and what the provider said
// it cost. Usage is nil when the provider reported none, which is also
// how a call that failed before a reply reads.
type Call struct {
	At          string
	SubjectType string
	SubjectID   string
	Model       string
	Answered    string
	Ms          int64
	Usage       *Usage
	Host        string
	Session     string
	Error       string
}

// LogCallsTo starts the call log at path. Empty stops it.
func LogCallsTo(path string) {
	callLog.Lock()
	defer callLog.Unlock()
	callLog.path = path
	if path != "" {
		os.MkdirAll(filepath.Dir(path), 0o700)
	}
}

type callRecord struct {
	At        string     `json:"at"`
	Model     string     `json:"model"`
	Millis    int64      `json:"ms"`
	Messages  []logMsg   `json:"messages"`
	Tools     []string   `json:"tools,omitempty"`
	Reply     string     `json:"reply,omitempty"`
	Reasoned  int        `json:"reasoned,omitempty"`
	Reasoning string     `json:"reasoning,omitempty"`
	Calls     []ToolCall `json:"toolCalls,omitempty"`
	Error     string     `json:"error,omitempty"`
	// Usage is the provider's own count and, from OpenRouter, the cost.
	Usage *Usage `json:"usage,omitempty"`
	// Session is the job the call belongs to, as OpenRouter groups it,
	// and Host who served it.
	Session string `json:"session,omitempty"`
	Host    string `json:"host,omitempty"`
	// Answered is the model that answered, as the provider names it.
	Answered string `json:"answered,omitempty"`
}

type logMsg struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

func logCall(req ChatRequest, start time.Time, reply Reply, err error) {
	at := start.UTC().Format(time.RFC3339)
	ms := time.Since(start).Milliseconds()
	errText := ""
	if err != nil {
		errText = err.Error()
	}
	call := Call{
		At: at, SubjectType: req.Subject.Type, SubjectID: req.Subject.ID,
		Model: req.Model, Answered: reply.Model, Ms: ms, Usage: reply.Usage,
		Host: reply.Host, Session: req.SessionID, Error: errText,
	}

	callLog.Lock()
	path, sink := callLog.path, callLog.sink
	callLog.Unlock()
	if path == "" {
		if sink != nil {
			sink(call)
		}
		return
	}
	rec := callRecord{
		At: at, Model: req.Model,
		Millis: ms, Reply: reply.Content, Calls: reply.ToolCalls, Reasoned: len(reply.Reasoning), Reasoning: reply.Reasoning, Usage: reply.Usage,
		Session: req.SessionID, Host: reply.Host, Answered: reply.Model,
	}
	for _, t := range req.Tools {
		rec.Tools = append(rec.Tools, t.Function.Name)
	}
	for _, m := range req.Messages {
		text := m.Content.Text()
		if parts := m.Content.Parts(); len(parts) > 0 {
			var b strings.Builder
			for _, p := range parts {
				if p.Type == "text" {
					b.WriteString(p.Text)
				} else {
					b.WriteString("[image]")
				}
				b.WriteString("\n")
			}
			text = b.String()
		}
		rec.Messages = append(rec.Messages, logMsg{m.Role, text})
	}
	rec.Error = errText
	line, _ := json.Marshal(rec)
	if st, e := os.Stat(path); e == nil && st.Size() > logMax {
		os.Rename(path, path+".1")
	}
	f, e := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if e != nil {
		if sink != nil {
			sink(call)
		}
		return
	}
	f.Write(append(line, '\n'))
	f.Close()
	if sink != nil {
		sink(call)
	}
}

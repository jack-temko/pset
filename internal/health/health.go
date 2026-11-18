package health

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/condition"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/platform"
	"github.com/jackt/pset/internal/store"
)

// Conditions is where a check says what it found: the step runner, which
// runs what waited on a condition once it holds, and refuses what needs one
// that does not.
type Conditions interface {
	Holds(ctx context.Context, condition string) error
	Lacks(ctx context.Context, condition string, why error, fix string) error
}

// Ollama is the local Ollama, which makes search's vectors: the models it
// has, and pulling one.
type Ollama interface {
	Models(ctx context.Context) ([]string, error)
	Pull(ctx context.Context, model string) error
}

// Config is what the service is built from.
type Config struct {
	Store   *store.Store
	Actions *action.Catalog
	// Conditions is nil when the service is built only to declare its
	// actions (generating the catalog).
	Conditions Conditions
	DataDir    string
	// Ollama is LiveOllama unless a test says otherwise; nil checks no
	// embeddings (they go if the embeddings eval drops them).
	Ollama Ollama
	// LookPath finds a program; exec.LookPath unless a test says otherwise.
	LookPath func(string) (string, error)
}

// Service checks what PSet depends on and keeps what it finds as
// conditions, for Settings' health list.
type Service struct{ c Config }

// The fix actions' ids, written on the condition each fixes.
const (
	fixDataFolder = "health.make_data_folder"
	fixEmbeddings = "health.get_embeddings"
)

// New is the health checks, with their fixes declared in c.Actions.
func New(c Config) *Service {
	if c.LookPath == nil {
		c.LookPath = exec.LookPath
	}
	s := &Service{c}
	action.Add(c.Actions, action.Def[struct{}]{
		ID: fixDataFolder, Name: "Make the data folder",
		Run: func(ctx context.Context, _ *action.Do, _ struct{}) error {
			if err := os.MkdirAll(s.c.DataDir, 0o700); err != nil {
				return makeFolderFailed.Wrap(err)
			}
			s.checkOne(ctx, condition.IDDataFolder)
			return nil
		},
	})
	action.Add(c.Actions, action.Def[struct{}]{
		ID: fixEmbeddings, Name: "Download the search model",
		Run: func(ctx context.Context, _ *action.Do, _ struct{}) error {
			if s.c.Ollama == nil {
				return errs.Gone.New("thing", "search model")
			}
			if err := s.c.Ollama.Pull(ctx, llm.EmbedModel); err != nil {
				return pullFailed.Wrap(err, "model", llm.EmbedModel)
			}
			s.checkOne(ctx, condition.IDEmbeddings)
			return nil
		},
	})
	return s
}

// names is what Settings calls each condition.
var names = map[condition.ID]string{
	condition.IDKey:        "OpenRouter key",
	condition.IDCredit:     "Credit",
	condition.IDProvider:   "Model provider",
	condition.IDPDFReader:  "Poppler",
	condition.IDScanReader: "Tesseract",
	condition.IDDataFolder: "Data folder",
	condition.IDDatabase:   "Database",
	condition.IDDiskSpace:  "Disk space",
	condition.IDEmbeddings: "Ollama",
}

// Check runs every check PSet can run, keeps what each found as its
// condition, and lists every condition. Run at start and each time
// Settings opens (A2): the key, credit and the provider are learned from
// calls, never checked, and the disk from a write that found it full.
func (s *Service) Check(ctx context.Context) (Health, error) {
	details := map[condition.ID]string{}
	for _, id := range condition.All {
		if d, ok := s.checkOne(ctx, id); ok {
			details[id] = d
		}
	}
	held, err := s.read(ctx)
	if err != nil {
		return Health{}, err
	}
	out := Health{Checks: make([]Check, 0, len(condition.All))}
	for _, id := range condition.All {
		c, ok := held[id]
		if !ok {
			// Never found wanting: it holds.
			c = condition.Condition{ID: id, Holds: true}
		}
		out.Checks = append(out.Checks, Check{Condition: c, Name: names[id], Detail: details[id]})
	}
	return out, nil
}

// found is what one check found: nil when the condition holds, else why,
// and the action that fixes it.
type found struct {
	detail string
	why    error
	fix    string
}

// checkOne runs a condition's check, if it has one, and keeps what it
// found. It reports the detail and whether there was a check.
func (s *Service) checkOne(ctx context.Context, id condition.ID) (string, bool) {
	var f found
	switch id {
	case condition.IDPDFReader:
		f = s.checkTool("pdftoppm", condition.PDFReaderMissing, platform.InstallHint(platform.Current, "poppler-utils", "poppler"))
	case condition.IDScanReader:
		f = s.checkTool("tesseract", condition.ScanReaderMissing, platform.InstallHint(platform.Current, "tesseract-ocr", "tesseract"))
	case condition.IDDataFolder:
		f = s.checkDataFolder()
	case condition.IDDatabase:
		f = s.checkDatabase(ctx)
	case condition.IDEmbeddings:
		if s.c.Ollama == nil {
			return "", false
		}
		f = s.checkOllama(ctx)
	default:
		return "", false
	}
	if s.c.Conditions != nil {
		var err error
		if f.why == nil {
			var proves bool
			if proves, err = s.disproves(ctx, id); err == nil && proves {
				err = s.c.Conditions.Holds(ctx, string(id))
			}
		} else {
			err = s.c.Conditions.Lacks(ctx, string(id), f.why, f.fix)
		}
		// The list still says what the check found; the next check keeps it.
		cleanup.Log("health: keep "+string(id), err)
	}
	return f.detail, true
}

// disprovable is, for each check, the catalog errors its passing shows are
// gone: a program found disproves it missing, Ollama listing the model
// disproves it unreachable or without it. It does not disprove what only a
// real use can (Ollama answering an embedding with an error, a write refused
// somewhere inside the data folder): a passing check never heals those, and
// their incident keeps its Try again.
var disprovable = map[condition.ID][]string{
	condition.IDPDFReader:  {condition.PDFReaderMissing.ID},
	condition.IDScanReader: {condition.ScanReaderMissing.ID},
	condition.IDDataFolder: {},
	condition.IDDatabase:   {},
	condition.IDEmbeddings: {llm.EmbedUnreachable.ID, EmbedModelMissing.ID},
}

// disproves is whether a passing check may say its condition holds: no
// open incident waits on it for a cause the check can't disprove. A
// condition the check itself found lacking has no incident, so it heals.
func (s *Service) disproves(ctx context.Context, id condition.ID) (bool, error) {
	ids, err := json.Marshal(disprovable[id])
	if err != nil {
		return false, errs.Data.Wrap(err)
	}
	var stuck int
	err = s.c.Store.DB.QueryRowContext(ctx, `SELECT count(*) FROM incidents i WHERE i.state = 'open' AND i.clears = ?
		AND NOT EXISTS (SELECT 1 FROM json_each(i.error, '$.chain') c WHERE c.value IN (SELECT value FROM json_each(?)))`,
		string(id), string(ids)).Scan(&stuck)
	if err != nil {
		return false, errs.Database.Wrap(err)
	}
	return stuck == 0, nil
}

// read is every condition kept so far, by id.
func (s *Service) read(ctx context.Context) (map[condition.ID]condition.Condition, error) {
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT id, seq, holds, since, error, fix FROM conditions`)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	out := map[condition.ID]condition.Condition{}
	for rows.Next() {
		var c condition.Condition
		var raw string
		if err := rows.Scan(&c.ID, &c.Seq, &c.Holds, &c.Since, &raw, &c.Fix); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		if !c.Holds {
			var v errs.View
			if err := json.Unmarshal([]byte(raw), &v); err == nil && v.ID != "" {
				c.Error = &v
			}
		} else {
			c.Fix = ""
		}
		out[c.ID] = c
	}
	return out, errs.Database.Of(rows.Err())
}

// checkTool looks for a program PSet runs, and its version.
func (s *Service) checkTool(bin string, missing *errs.Entry, install string) found {
	path, err := s.c.LookPath(bin)
	if err != nil {
		return found{detail: "not installed. Install it with " + install, why: missing.Wrap(err)}
	}
	return found{detail: strings.TrimSpace(bin + " " + toolVersion(path))}
}

// toolVersion finds the version number in a tool's -v output, which both
// poppler and tesseract print in their own format.
func toolVersion(path string) string {
	out, err := exec.Command(path, "-v").CombinedOutput()
	if err != nil && len(out) == 0 {
		return ""
	}
	for _, f := range strings.Fields(string(out)) {
		f = strings.TrimPrefix(f, "v")
		if len(f) > 0 && f[0] >= '0' && f[0] <= '9' && strings.Contains(f, ".") {
			return f
		}
	}
	return ""
}

// checkDataFolder: the folder is there and PSet can write in it. Features
// make their own folders inside it as they need them.
func (s *Service) checkDataFolder() found {
	dir := s.c.DataDir
	if st, err := os.Stat(dir); err != nil || !st.IsDir() {
		return found{detail: dir + " doesn't exist", why: condition.DataFolderRefused.New(), fix: fixDataFolder}
	}
	f, err := os.CreateTemp(dir, ".pset-probe-*")
	if err != nil {
		return found{detail: dir + " is not writable. Check its permissions.", why: condition.DataFolderRefused.Wrap(err)}
	}
	cleanup.Close(f)
	cleanup.Remove(f.Name())
	out := found{detail: dir + " is writable"}
	if old := oldMacData(dir); old != "" {
		out.detail += ". Data from an earlier version is still in " + old + ": PSet did not move it. Copy it here to bring it over"
	}
	return out
}

// oldMacData is the folder an earlier PSet kept its library in on a Mac,
// when there is one with a database in it that is not this one; else "".
func oldMacData(dir string) string {
	if platform.Current != platform.Mac {
		return ""
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	old := platform.OldMacDataDir(home)
	if old == dir {
		return ""
	}
	if _, err := os.Stat(filepath.Join(old, "pset.db")); err != nil {
		return ""
	}
	return old
}

// checkDatabase asks SQLite whether the store's file is sound.
func (s *Service) checkDatabase(ctx context.Context) found {
	var verdict string
	if err := s.c.Store.DB.QueryRowContext(ctx, `PRAGMA quick_check`).Scan(&verdict); err != nil {
		return found{detail: "couldn't check it: " + err.Error(), why: condition.DatabaseUnsound.Wrap(err)}
	}
	if verdict != "ok" {
		return found{detail: "damaged: " + verdict, why: condition.DatabaseUnsound.Wrap(errors.New(verdict))}
	}
	return found{detail: "sound"}
}

// ollamaTimeout: Ollama is on this machine, so it answers at once or isn't
// running.
const ollamaTimeout = 3 * time.Second

// checkOllama asks the local Ollama which models it has. A missing model
// can be fixed, since Ollama downloads it; Ollama itself can't be.
func (s *Service) checkOllama(ctx context.Context) found {
	ctx, cancel := context.WithTimeout(ctx, ollamaTimeout)
	defer cancel()
	have, err := s.c.Ollama.Models(ctx)
	if err != nil {
		var e *errs.Error
		if !errors.As(err, &e) {
			err = llm.EmbedUnreachable.Wrap(err)
		}
		return found{detail: "not running. " + platform.OllamaHint(platform.Current), why: err}
	}
	for _, m := range have {
		if m == llm.EmbedModel || strings.HasPrefix(m, llm.EmbedModel+":") {
			return found{detail: llm.EmbedModel}
		}
	}
	return found{
		detail: "running, without " + llm.EmbedModel + ". Fix downloads it (about 270 MB)",
		why:    EmbedModelMissing.New("model", llm.EmbedModel), fix: fixEmbeddings,
	}
}

// Routes mounts Settings' health list; each fix is an action.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", httpx.Reply(func(r *http.Request) (Health, error) {
		return s.Check(r.Context())
	}))
}

// AtStart runs every check once, as PSet starts (A2), logging what it can't
// keep.
func (s *Service) AtStart(ctx context.Context) {
	if _, err := s.Check(ctx); err != nil {
		slog.Warn("health: the checks at start", "err", err)
	}
}

package engine

import "fmt"

type Severity string

const (
	SeverityInfo    Severity = "info"
	SeverityWarning Severity = "warning"
	SeverityError   Severity = "error"
)

type Status string

const (
	StatusOK     Status = "ok"
	StatusFixed  Status = "fixed"
	StatusWarn   Status = "warn"
	StatusFailed Status = "failed"
)

// Link points at the surface that repairs a finding, when the fix lives
// elsewhere in the app (Settings owns the API key and endpoints; doctor
// only reports).
type Link struct {
	Label string
	Href  string
}

type Finding struct {
	Severity Severity
	Message  string
	Link     *Link
}

type CheckResult struct {
	Name     string
	Status   Status
	Findings []Finding
}

func (c *CheckResult) add(sev Severity, format string, args ...any) {
	c.Findings = append(c.Findings, Finding{Severity: sev, Message: fmt.Sprintf(format, args...)})
}

func (c *CheckResult) fail(format string, args ...any) {
	c.Status = StatusFailed
	c.add(SeverityError, format, args...)
}

// failLink records a failure whose repair lives somewhere else in the app.
func (c *CheckResult) failLink(link Link, format string, args ...any) {
	c.Status = StatusFailed
	c.Findings = append(c.Findings, Finding{
		Severity: SeverityError,
		Message:  fmt.Sprintf(format, args...),
		Link:     &link,
	})
}

type Report struct {
	Checks []CheckResult
}

// OK is false only when some check failed; warn still counts as usable.
func (r *Report) OK() bool {
	for _, c := range r.Checks {
		if c.Status == StatusFailed {
			return false
		}
	}
	return true
}

func (r *Report) Findings(sev Severity) []Finding {
	var out []Finding
	for _, c := range r.Checks {
		for _, f := range c.Findings {
			if f.Severity == sev {
				out = append(out, f)
			}
		}
	}
	return out
}

func (r *Report) Infos() []Finding    { return r.Findings(SeverityInfo) }
func (r *Report) Warnings() []Finding { return r.Findings(SeverityWarning) }
func (r *Report) Errors() []Finding   { return r.Findings(SeverityError) }

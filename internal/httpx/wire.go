package httpx

// Code is a stable error code the UI switches on. Generated into TS.
type Code string

const (
	// CodeNotFound is a thing that isn't there.
	CodeNotFound Code = "not_found"
	// CodeInvalid is input that is wrong; Field names it.
	CodeInvalid Code = "invalid"
	// CodeNotConfigured is something that needs setting up first, such as a key.
	CodeNotConfigured Code = "not_configured"
	// CodeDuplicateBook is a book that is already on the shelf; ID names it.
	CodeDuplicateBook Code = "duplicate_book"
	// CodeUnreachable is a service that did not answer.
	CodeUnreachable Code = "unreachable"
	// CodeBadKey is a key the provider refused.
	CodeBadKey Code = "bad_key"
	// CodeBadModel is a model the provider does not know.
	CodeBadModel Code = "bad_model"
	// CodeBusy is work that cannot start while something else runs.
	CodeBusy Code = "busy"
	// CodeForbidden is a request that is not allowed.
	CodeForbidden Code = "forbidden"
	// CodeInternal is a failure that is PSet's own.
	CodeInternal Code = "internal"
)

// Error is the one error shape on the wire. Message is display-ready copy;
// Field names the input at fault; ID points at a resource the error is
// about (the existing book, for duplicate_book).
type Error struct {
	Code    Code   `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
	ID      string `json:"id,omitempty"`

	status int
}

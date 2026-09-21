package httpx

// Code is a stable error code the UI switches on. Generated into TS.
type Code string

const (
	CodeNotFound      Code = "not_found"
	CodeInvalid       Code = "invalid"
	CodeNotConfigured Code = "not_configured"
	CodeDuplicateBook Code = "duplicate_book"
	CodeUnreachable   Code = "unreachable"
	CodeBadKey        Code = "bad_key"
	CodeBadModel      Code = "bad_model"
	CodeBusy          Code = "busy"
	CodeInternal      Code = "internal"
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

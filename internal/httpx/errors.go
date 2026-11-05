package httpx

import "github.com/jackt/pset/internal/errs"

// The upload entries httpx owns: every route that takes a file reads the
// same multipart request, and fails the same ways. They point at the "file"
// field.
var (
	// NotMultipart is an upload that is not a multipart request.
	NotMultipart = errs.Define(errs.Entry{
		ID:    "request.not_multipart",
		What:  "Send the file as a multipart upload.",
		Scope: errs.ScopeField,
	})
	// NoFile is a multipart upload with no file in it.
	NoFile = errs.Define(errs.Entry{
		ID:    "request.no_file",
		What:  "No file came with the upload.",
		Scope: errs.ScopeField,
	})
	// UploadCut is an upload that broke off.
	UploadCut = errs.Define(errs.Entry{
		ID:    "request.upload_cut",
		What:  "The upload was cut off.",
		Scope: errs.ScopeField,
	})
)

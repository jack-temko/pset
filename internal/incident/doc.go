// Package incident is the wire shape of a failure: one incident per cause
// and subject, on the change log, said once at the closest place that owns
// it, resolving by itself when its cause is gone (ideas/errors-grill.md).
// Wire types only, for now; it replaces internal/errlog's errors table once
// the later tracks are built.
package incident

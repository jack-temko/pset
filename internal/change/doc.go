// Package change is the live-update contract: the change log's event, the
// kinds of resource it names, and the events that ride the same stream
// without being logged (a document's blocks as they are written, a step's
// activity line). It holds wire types only; the log itself is written by
// database triggers (ideas/backend-courses-grill.md, D11).
package change

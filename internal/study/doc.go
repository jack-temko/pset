// Package study is time spent on the store: stretches of study in a course,
// summed into the week Home reports. It reports and never nags: no targets.
// It is the old activity package moved onto courses (track 7d of
// ideas/backend-courses.md); activity stays for the old screens until the
// cut-over, and its overlap arithmetic is copied here, not shared, so it can
// go then.
//
//	POST /api/time            a stretch, or its latest end
//	GET  /api/time?since=     the week since then
//	time.clear                the action that forgets all time spent
//
// Questions and sets worked come with track 5, from the work.
package study

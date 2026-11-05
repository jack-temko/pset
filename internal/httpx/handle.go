package httpx

import "net/http"

// The handlers most routes are: decode a body if there is one, call the
// feature's service, answer with what it returned. Each takes a function
// of the request (its Context and PathValue) and answers a returned error
// as H does, so a route says only what it calls.

// Reply answers 200 with what fn returns.
func Reply[Out any](fn func(r *http.Request) (Out, error)) http.HandlerFunc {
	return H(func(w http.ResponseWriter, r *http.Request) error {
		out, err := fn(r)
		if err != nil {
			return err
		}
		return OK(w, out)
	})
}

// Send reads the JSON body into an In, calls fn, and answers status with
// what fn returns: 201 for a thing made, 202 for work started.
func Send[In, Out any](status int, fn func(r *http.Request, in In) (Out, error)) http.HandlerFunc {
	return H(func(w http.ResponseWriter, r *http.Request) error {
		var in In
		if err := Decode(r, &in); err != nil {
			return err
		}
		out, err := fn(r, in)
		if err != nil {
			return err
		}
		JSON(w, status, out)
		return nil
	})
}

// Take reads the JSON body into an In, calls fn, and answers 204: a note
// taken, with nothing to say back.
func Take[In any](fn func(r *http.Request, in In) error) http.HandlerFunc {
	return H(func(w http.ResponseWriter, r *http.Request) error {
		var in In
		if err := Decode(r, &in); err != nil {
			return err
		}
		if err := fn(r, in); err != nil {
			return err
		}
		return NoContent(w)
	})
}

// Act runs fn and answers 204: a thing removed, an act done.
func Act(fn func(r *http.Request) error) http.HandlerFunc {
	return H(func(w http.ResponseWriter, r *http.Request) error {
		if err := fn(r); err != nil {
			return err
		}
		return NoContent(w)
	})
}

package homework

import (
	"encoding/json"
	"testing"

	"github.com/jackt/pset/internal/doc"
)

func TestNonNilListsNeverMarshalNull(t *testing.T) {
	for _, in := range [][][]doc.Run{nil, {nil}} {
		out, err := json.Marshal(nonNilLists(in))
		if err != nil {
			t.Fatal(err)
		}
		if s := string(out); s != "[]" && s != "[[]]" {
			t.Errorf("got %s", s)
		}
	}
}

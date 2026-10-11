package settings

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

// The web draws the models line of Settings from this list on a first visit,
// before the server has answered, so it is the same sentence and wraps the same
// (web/src/api/default-models.json). It must be what the server says.
func TestTheWebsDefaultModelsAreTheServers(t *testing.T) {
	raw, err := os.ReadFile("../../web/src/api/default-models.json")
	if err != nil {
		t.Fatal(err)
	}
	var web []ModelUse
	if err := json.Unmarshal(raw, &web); err != nil {
		t.Fatal(err)
	}
	if got := models(); !reflect.DeepEqual(web, got) {
		want, _ := json.MarshalIndent(got, "", "  ")
		t.Fatalf("web/src/api/default-models.json is out of date; it should be:\n%s", want)
	}
}

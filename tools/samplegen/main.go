// Command samplegen writes the deterministic sample textbooks used by the
// PSet test suite: a digital PDF with a real text layer and bookmarks, a fake
// "scan" whose pages are images only, a digital PDF without bookmarks (its
// headings are inferred from font sizes), and a manifest.json of expectations
// for all three.
package main

import (
	"flag"
	"fmt"
	"log"
)

func main() {
	out := flag.String("out", "testdata", "output directory")
	flag.Parse()

	m, err := Generate(*out)
	if err != nil {
		log.Fatalf("samplegen: %v", err)
	}
	for _, b := range []BookManifest{m.Digital, m.Scanned, m.Flat} {
		fmt.Printf("wrote %s: %d pages, %d facts, sha256 %s\n",
			b.File, b.Pages, len(b.Facts), b.SHA256)
	}
	fmt.Printf("wrote manifest.json in %s\n", *out)
}

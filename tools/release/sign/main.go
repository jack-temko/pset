// Command sign is the release runner's signer. `sign -generate` makes a key
// pair once: the private half goes in the repository secret RELEASE_SIGNING_KEY,
// the public half in internal/update. `sign -in SHA256SUMS -out SHA256SUMS.sig`
// signs a checksum file with the key in $RELEASE_SIGNING_KEY.
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/jackt/pset/internal/releasesign"
)

func main() {
	generate := flag.Bool("generate", false, "make a key pair and print it")
	in := flag.String("in", "", "the file to sign")
	out := flag.String("out", "", "where to write the signature")
	flag.Parse()

	if *generate {
		priv, pub, err := releasesign.Generate()
		if err != nil {
			fail(err)
		}
		fmt.Println("private (the secret RELEASE_SIGNING_KEY; keep an offline copy, never commit it):")
		fmt.Println(priv)
		fmt.Println("public (built into PSet):")
		fmt.Println(pub)
		return
	}
	if *in == "" || *out == "" {
		fail(fmt.Errorf("usage: sign -generate  |  sign -in FILE -out SIGNATURE"))
	}
	msg, err := os.ReadFile(*in)
	if err != nil {
		fail(err)
	}
	sig, err := releasesign.Sign(os.Getenv("RELEASE_SIGNING_KEY"), msg)
	if err != nil {
		fail(err)
	}
	if err := os.WriteFile(*out, []byte(sig+"\n"), 0o644); err != nil {
		fail(err)
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "sign:", err)
	os.Exit(1)
}

// Command sign is the release runner's signer. `sign -setup` makes the key
// pair once: the private half is stored as the repository secret
// RELEASE_SIGNING_KEY (through the gh CLI) and in a file only you can read, to
// back up; the public half is printed, to go in internal/update/key.go. It never
// prints the private half. `sign -generate` just prints a pair. `sign -in
// SHA256SUMS -out SHA256SUMS.sig` signs a checksum file with the key in
// $RELEASE_SIGNING_KEY.
package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/jackt/pset/internal/releasesign"
)

func main() {
	setup := flag.Bool("setup", false, "make the key pair, store the private half as a repository secret and in a private file, print the public half")
	generate := flag.Bool("generate", false, "make a key pair and print it")
	in := flag.String("in", "", "the file to sign")
	out := flag.String("out", "", "where to write the signature")
	flag.Parse()

	if *setup {
		if err := runSetup(); err != nil {
			fail(err)
		}
		return
	}
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

// runSetup makes the key and stores the private half in two places, without
// showing it: the repository secret and a file for an offline copy.
func runSetup() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dir := filepath.Join(home, ".config", "pset-release")
	file := filepath.Join(dir, "signing-key")
	if _, err := os.Stat(file); err == nil {
		return fmt.Errorf("%s already exists: a release key was made already. Remove it yourself to make a new one (installs built with the old public key can then no longer update)", file)
	}
	priv, pub, err := releasesign.Generate()
	if err != nil {
		return err
	}
	cmd := exec.Command("gh", "secret", "set", "RELEASE_SIGNING_KEY")
	cmd.Stdin = strings.NewReader(priv)
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("couldn't store the repository secret with gh: %w (nothing was saved)", err)
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	if err := os.WriteFile(file, []byte(priv+"\n"), 0o600); err != nil {
		return err
	}
	fmt.Println("The private key is the repository secret RELEASE_SIGNING_KEY, and is saved in")
	fmt.Println(" ", file)
	fmt.Println("Back that file up somewhere safe and offline; it is not in the repository.")
	fmt.Println()
	fmt.Println("The public key, for internal/update/key.go:")
	fmt.Println(pub)
	return nil
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "sign:", err)
	os.Exit(1)
}

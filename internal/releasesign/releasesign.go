// Package releasesign signs and checks a release's checksum file. The runner
// signs SHA256SUMS with a private key kept as a repository secret; PSet
// carries the public key and checks the signature before it believes a
// download. Ed25519 from the standard library, keys and signatures as base64.
package releasesign

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

// Generate makes a key pair: the private seed to keep secret, the public key
// to build into PSet. Both are base64.
func Generate() (private, public string, err error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", err
	}
	return base64.StdEncoding.EncodeToString(priv.Seed()), base64.StdEncoding.EncodeToString(pub), nil
}

// Sign signs a message with a private seed from Generate and returns the
// signature as base64.
func Sign(seed string, message []byte) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(seed))
	if err != nil || len(raw) != ed25519.SeedSize {
		return "", errors.New("the signing key isn't a base64 Ed25519 seed")
	}
	sig := ed25519.Sign(ed25519.NewKeyFromSeed(raw), message)
	return base64.StdEncoding.EncodeToString(sig), nil
}

// Verify checks a base64 signature of a message against a base64 public key.
func Verify(public string, message []byte, signature string) error {
	pub, err := base64.StdEncoding.DecodeString(strings.TrimSpace(public))
	if err != nil || len(pub) != ed25519.PublicKeySize {
		return errors.New("the public key isn't a base64 Ed25519 key")
	}
	sig, err := base64.StdEncoding.DecodeString(strings.TrimSpace(signature))
	if err != nil || len(sig) != ed25519.SignatureSize {
		return errors.New("the signature isn't a base64 Ed25519 signature")
	}
	if !ed25519.Verify(pub, message, sig) {
		return errors.New("the signature doesn't match: this file was not signed by PSet's release key")
	}
	return nil
}

// Entry is one line of a SHA256SUMS file: a file and its checksum.
type Entry struct {
	Sum  string
	File string
}

// ParseSums reads a SHA256SUMS file ("<hex>  <file>" a line; a "*" before the
// file name marks binary mode and is dropped).
func ParseSums(text string) ([]Entry, error) {
	var out []Entry
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		sum, file, ok := strings.Cut(line, " ")
		file = strings.TrimPrefix(strings.TrimSpace(file), "*")
		if !ok || len(sum) != 64 || file == "" {
			return nil, fmt.Errorf("a line of the checksums isn't \"<sha256>  <file>\": %q", line)
		}
		out = append(out, Entry{Sum: strings.ToLower(sum), File: file})
	}
	return out, nil
}

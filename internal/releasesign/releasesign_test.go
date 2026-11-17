package releasesign

import (
	"strings"
	"testing"
)

func TestSignThenVerify(t *testing.T) {
	priv, pub, err := Generate()
	if err != nil {
		t.Fatal(err)
	}
	msg := []byte("abc  pset-0.1.0-linux-amd64.tar.gz\n")
	sig, err := Sign(priv, msg)
	if err != nil {
		t.Fatal(err)
	}
	if err := Verify(pub, msg, sig); err != nil {
		t.Fatalf("a good signature failed: %v", err)
	}
	if err := Verify(pub, append(msg, 'x'), sig); err == nil {
		t.Fatal("a changed message verified")
	}
	_, otherPub, _ := Generate()
	if err := Verify(otherPub, msg, sig); err == nil {
		t.Fatal("another key's public half verified it")
	}
}

func TestBadKeysAndSignaturesAreRefusedInWords(t *testing.T) {
	if _, err := Sign("not base64!", nil); err == nil {
		t.Error("a bad seed signed")
	}
	_, pub, _ := Generate()
	for _, sig := range []string{"", "AAAA", "not base64!"} {
		if err := Verify(pub, []byte("x"), sig); err == nil {
			t.Errorf("%q verified", sig)
		}
	}
	if err := Verify("short", []byte("x"), "AAAA"); err == nil {
		t.Error("a bad public key verified")
	}
}

func TestParseSums(t *testing.T) {
	sum := strings.Repeat("a", 64)
	got, err := ParseSums(sum + "  pset-1-linux-amd64.tar.gz\n" + strings.ToUpper(sum) + " *install.sh\n\n")
	if err != nil || len(got) != 2 || got[0].File != "pset-1-linux-amd64.tar.gz" || got[1].File != "install.sh" || got[1].Sum != sum {
		t.Fatalf("%+v %v", got, err)
	}
	if _, err := ParseSums("short  file"); err == nil {
		t.Error("a short checksum parsed")
	}
}

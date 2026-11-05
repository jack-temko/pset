package update

// PublicKey is the release key, base64 Ed25519: every update's checksums must
// be signed by the matching private key (a repository secret) or PSet refuses
// it. Empty until the key is made (`go run ./tools/release/sign -setup`), and
// then an install can't update itself.
const PublicKey = ""

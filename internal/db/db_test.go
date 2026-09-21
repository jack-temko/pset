package db

import (
	"context"
	"path/filepath"
	"testing"
)

func TestMigrateIsIdempotentAndWipeStartsOver(t *testing.T) {
	ctx := context.Background()
	d, err := Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	migs := []Migration{
		{"a/1", `CREATE TABLE a (id INTEGER PRIMARY KEY)`},
		{"b/1", `CREATE TABLE b (id INTEGER PRIMARY KEY, a INTEGER REFERENCES a(id) ON DELETE CASCADE)`},
	}
	for range 2 {
		if err := Migrate(ctx, d, migs); err != nil {
			t.Fatal(err)
		}
	}
	d.Exec(`INSERT INTO a VALUES (1)`)
	d.Exec(`INSERT INTO b VALUES (1, 1)`)

	// Foreign keys are on: deleting the parent takes the child.
	d.Exec(`DELETE FROM a`)
	var n int
	d.QueryRow(`SELECT count(*) FROM b`).Scan(&n)
	if n != 0 {
		t.Fatalf("cascade left %d rows", n)
	}

	d.Exec(`INSERT INTO a VALUES (2)`)
	if err := Wipe(ctx, d, migs); err != nil {
		t.Fatal(err)
	}
	d.QueryRow(`SELECT count(*) FROM a`).Scan(&n)
	if n != 0 {
		t.Fatalf("wipe left %d rows", n)
	}
	p, _ := Pending(ctx, d, migs)
	if len(p) != 0 {
		t.Fatalf("pending after wipe: %v", p)
	}
}

func TestPendingNamesUnapplied(t *testing.T) {
	ctx := context.Background()
	d, _ := Open(filepath.Join(t.TempDir(), "pset.db"))
	defer d.Close()
	first := []Migration{{"a/1", `CREATE TABLE a (id INTEGER)`}}
	Migrate(ctx, d, first)
	p, err := Pending(ctx, d, append(first, Migration{"a/2", `ALTER TABLE a ADD COLUMN x TEXT`}))
	if err != nil || len(p) != 1 || p[0] != "a/2" {
		t.Fatalf("pending = %v, %v", p, err)
	}
}

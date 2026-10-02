package db

import (
	"context"
	"os"
	"path/filepath"
	"strings"
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
		{Name: "a/1", SQL: `CREATE TABLE a (id INTEGER PRIMARY KEY)`},
		{Name: "b/1", SQL: `CREATE TABLE b (id INTEGER PRIMARY KEY, a INTEGER REFERENCES a(id) ON DELETE CASCADE)`},
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
	first := []Migration{{Name: "a/1", SQL: `CREATE TABLE a (id INTEGER)`}}
	Migrate(ctx, d, first)
	p, err := Pending(ctx, d, append(first, Migration{Name: "a/2", SQL: `ALTER TABLE a ADD COLUMN x TEXT`}))
	if err != nil || len(p) != 1 || p[0] != "a/2" {
		t.Fatalf("pending = %v, %v", p, err)
	}
}

func TestBackupBeforeMigratingOnlyWhenAnExistingDatabaseWillChange(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	d, err := Open(filepath.Join(dir, "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	one := Migration{Name: "t/1", SQL: `CREATE TABLE a (x TEXT)`}
	two := Migration{Name: "t/2", SQL: `ALTER TABLE a ADD COLUMN y TEXT`}

	// A first start has nothing to protect.
	if p, err := BackupBeforeMigrating(ctx, d, []Migration{one}, dir, "1.0.0"); err != nil || p != "" {
		t.Fatalf("fresh database: %q %v", p, err)
	}
	if err := Migrate(ctx, d, []Migration{one}); err != nil {
		t.Fatal(err)
	}
	d.Exec(`INSERT INTO a (x) VALUES ('keep me')`)
	// Nothing pending: nothing to do.
	if p, _ := BackupBeforeMigrating(ctx, d, []Migration{one}, dir, "1.0.0"); p != "" {
		t.Fatalf("nothing pending, yet %q", p)
	}
	// A new version with a new migration: backed up first, and the copy has the data.
	p, err := BackupBeforeMigrating(ctx, d, []Migration{one, two}, dir, "1.1.0")
	if err != nil || p == "" {
		t.Fatalf("existing database with a pending migration: %q %v", p, err)
	}
	if !strings.Contains(filepath.Base(p), "-before-1.1.0.db") {
		t.Errorf("the copy is named %q", p)
	}
	b, err := Open(p)
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	var n int
	if err := b.QueryRow(`SELECT count(*) FROM a WHERE x = 'keep me'`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("the backup lost the data: %d %v", n, err)
	}
}

func TestOnlyTheNewestBackupsAreKept(t *testing.T) {
	dir := t.TempDir()
	for _, n := range []string{"pset-20260101-000000-before-a.db", "pset-20260102-000000-before-b.db", "pset-20260103-000000-before-c.db", "pset-20260104-000000-before-d.db", "notes.txt"} {
		os.WriteFile(filepath.Join(dir, n), []byte("x"), 0o600)
	}
	pruneBackups(dir)
	left, _ := os.ReadDir(dir)
	var names []string
	for _, e := range left {
		names = append(names, e.Name())
	}
	want := "notes.txt pset-20260102-000000-before-b.db pset-20260103-000000-before-c.db pset-20260104-000000-before-d.db"
	if got := strings.Join(names, " "); got != want {
		t.Fatalf("left %q, want %q", got, want)
	}
}

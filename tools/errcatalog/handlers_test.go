package main

import (
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"strings"
	"testing"
)

// A handler passed to httpx.H, Reply, Send, Take or Act answers a returned
// error as the error catalog's (internal/errs). One that returns fmt.Errorf
// or errors.New directly answers internal.unexpected, whatever went wrong:
// it must raise an entry (or return what a service returned). This is the
// check ideas/error-catalog-grill.md (D8, A4) asked for, as a test rather
// than a golangci-lint plugin.
func TestHandlersReturnNoPlainErrors(t *testing.T) {
	wrappers := map[string]bool{"H": true, "Reply": true, "Send": true, "Take": true, "Act": true}
	dirs, err := filepath.Glob("../../internal/*")
	if err != nil {
		t.Fatal(err)
	}
	checked := 0
	for _, dir := range dirs {
		fset := token.NewFileSet()
		names, err := filepath.Glob(filepath.Join(dir, "*.go"))
		if err != nil {
			t.Fatal(err)
		}
		var files []*ast.File
		funcs := map[string]*ast.FuncDecl{}
		for _, name := range names {
			if strings.HasSuffix(name, "_test.go") {
				continue
			}
			f, err := parser.ParseFile(fset, name, nil, 0)
			if err != nil {
				t.Fatal(err)
			}
			files = append(files, f)
			for _, d := range f.Decls {
				if fd, ok := d.(*ast.FuncDecl); ok {
					funcs[fd.Name.Name] = fd
				}
			}
		}
		for _, f := range files {
			ast.Inspect(f, func(n ast.Node) bool {
				call, ok := n.(*ast.CallExpr)
				if !ok {
					return true
				}
				sel, ok := call.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}
				if x, ok := sel.X.(*ast.Ident); !ok || x.Name != "httpx" || !wrappers[sel.Sel.Name] {
					return true
				}
				for _, arg := range call.Args {
					var body ast.Node
					switch a := arg.(type) {
					case *ast.FuncLit:
						body = a.Body
					case *ast.Ident:
						if fd := funcs[a.Name]; fd != nil {
							body = fd.Body
						}
					case *ast.SelectorExpr:
						if fd := funcs[a.Sel.Name]; fd != nil {
							body = fd.Body
						}
					}
					if body == nil {
						continue
					}
					checked++
					for _, bad := range plainErrorReturns(body) {
						t.Errorf("%s: a handler returns a plain error; raise a catalog entry instead", fset.Position(bad.Pos()))
					}
				}
				return true
			})
		}
	}
	if checked == 0 {
		t.Fatal("found no handlers to check: the test is looking in the wrong place")
	}
}

// plainErrorReturns are the return statements under body that return
// fmt.Errorf(...) or errors.New(...) as they are. A nested function literal
// has returns of its own and is not the handler's.
func plainErrorReturns(body ast.Node) []*ast.ReturnStmt {
	var out []*ast.ReturnStmt
	ast.Inspect(body, func(n ast.Node) bool {
		switch n := n.(type) {
		case *ast.FuncLit:
			return false
		case *ast.ReturnStmt:
			for _, r := range n.Results {
				call, ok := r.(*ast.CallExpr)
				if !ok {
					continue
				}
				sel, ok := call.Fun.(*ast.SelectorExpr)
				if !ok {
					continue
				}
				x, ok := sel.X.(*ast.Ident)
				if ok && ((x.Name == "fmt" && sel.Sel.Name == "Errorf") || (x.Name == "errors" && sel.Sel.Name == "New")) {
					out = append(out, n)
				}
			}
		}
		return true
	})
	return out
}

func TestThePlainErrorCheckSeesWhatItShould(t *testing.T) {
	src := `package p
func f() {
	_ = func() error {
		_ = func() error { return fmt.Errorf("inner is not the handler's") }
		if x { return errors.New("plain") }
		if y { return thing.Errorf("not fmt") }
		return fmt.Errorf("also plain: %w", err)
	}
}`
	f, err := parser.ParseFile(token.NewFileSet(), "p.go", src, 0)
	if err != nil {
		t.Fatal(err)
	}
	var lit *ast.FuncLit
	ast.Inspect(f, func(n ast.Node) bool {
		if l, ok := n.(*ast.FuncLit); ok && lit == nil {
			lit = l
		}
		return true
	})
	if got := len(plainErrorReturns(lit.Body)); got != 2 {
		t.Errorf("found %d plain returns, want 2", got)
	}
}

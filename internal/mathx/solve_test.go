package mathx

import (
	"math"
	"strings"
	"testing"
)

func TestSolveLinearExactRational(t *testing.T) {
	// 2x + y = 5; x + 3y = 10 → x = 1, y = 3.
	x, err := SolveLinear([][]string{{"2", "1"}, {"1", "3"}}, []string{"5", "10"})
	if err != nil {
		t.Fatal(err)
	}
	if len(x) != 2 || x[0].String() != "1" || x[1].String() != "3" {
		t.Errorf("got %v, %v; want 1, 3", x[0], x[1])
	}
	if !x[0].IsExact() || !x[1].IsExact() {
		t.Error("an all-rational system should solve exactly")
	}
}

func assertReconstructs(t *testing.T, a [][]string, b []string, x []Value) {
	t.Helper()
	for i := range a {
		sum, err := Eval(strings.Join([]string{
			"(" + a[i][0] + ")*(" + x[0].ExprString() + ")",
			"(" + a[i][1] + ")*(" + x[1].ExprString() + ")",
		}, "+"))
		if err != nil {
			t.Fatal(err)
		}
		want, _ := Eval(b[i])
		got, wantc := sum.complex(), want.complex()
		if math.Abs(real(got)-real(wantc)) > 1e-3 || math.Abs(imag(got)-imag(wantc)) > 1e-3 {
			t.Errorf("row %d reconstructs to %s, want %s", i, sum, want)
		}
	}
}

func TestSolveLinearFractionsStayExact(t *testing.T) {
	x, err := SolveLinear([][]string{{"1/3", "1/2"}, {"1/2", "1/3"}}, []string{"7/6", "5/6"})
	if err != nil {
		t.Fatal(err)
	}
	assertReconstructs(t, [][]string{{"1/3", "1/2"}, {"1/2", "1/3"}}, []string{"7/6", "5/6"}, x)
	if !x[0].IsExact() {
		t.Errorf("solution should stay exact, got %s", x[0])
	}
}

func TestSolveLinearComplex(t *testing.T) {
	// A mesh system with complex impedance; verify by reconstruction.
	a := [][]string{{"4+j6", "-j2"}, {"-j2", "8-j3"}}
	b := []string{"24", "0"}
	x, err := SolveLinear(a, b)
	if err != nil {
		t.Fatal(err)
	}
	assertReconstructs(t, a, b, x)
}

func TestSolveLinearSingular(t *testing.T) {
	if _, err := SolveLinear([][]string{{"1", "1"}, {"2", "2"}}, []string{"1", "2"}); err == nil {
		t.Fatal("a singular system should error")
	}
}

func TestSolveLinearShapeErrors(t *testing.T) {
	cases := []struct {
		a [][]string
		b []string
	}{
		{[][]string{{"1"}}, []string{}},
		{[][]string{{"1", "2"}}, []string{"1"}},
		{[][]string{{"1", "2"}, {"3"}}, []string{"1", "2"}},
		{[][]string{{"1", "oops"}}, []string{"1"}},
	}
	for i, c := range cases {
		if _, err := SolveLinear(c.a, c.b); err == nil {
			t.Errorf("case %d should error", i)
		}
	}
}

func TestSolveLinearRejectsHugeSystems(t *testing.T) {
	n := maxSystemSize + 1
	a := make([][]string, n)
	b := make([]string, n)
	for i := range a {
		a[i] = make([]string, n)
		for j := range a[i] {
			a[i][j] = "1"
		}
		b[i] = "1"
	}
	if _, err := SolveLinear(a, b); err == nil {
		t.Fatalf("systems over %d unknowns should be refused", maxSystemSize)
	}
}

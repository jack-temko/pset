package mathx

import (
	"math"
	"testing"
)

func TestEvalExact(t *testing.T) {
	cases := []struct {
		expr string
		want string
	}{
		{"1 + 2", "3"},
		{"7/3", "7/3 ≈ 2.33333"},
		{"1/3 + 1/6", "1/2 ≈ 0.5"},
		{"0.1 + 0.2", "3/10 ≈ 0.3"},
		{"2^10", "1024"},
		{"2^-2", "1/4 ≈ 0.25"},
		{"(-2)^3", "-8"},
		{"(1/2)^2", "1/4 ≈ 0.25"},
		{"sqrt(4)", "2"},
		{"sqrt(2)", "1.41421"},
		{"abs(-7/2)", "7/2 ≈ 3.5"},
		{"max(3, 1/2, 2)", "3"},
		{"min(3, 1/2, 2)", "1/2 ≈ 0.5"},
		{"floor(7/2)", "3"},
		{"round(5/2)", "3"},
		{"100 * (1 + 1/10)", "110"},
	}
	for _, c := range cases {
		v, err := Eval(c.expr)
		if err != nil {
			t.Errorf("Eval(%q): %v", c.expr, err)
			continue
		}
		if got := v.String(); got != c.want {
			t.Errorf("Eval(%q) = %q, want %q", c.expr, got, c.want)
		}
		if !v.IsExact() && c.want != "1.41421" {
			t.Errorf("Eval(%q) lost exactness", c.expr)
		}
	}
}

func TestEvalComplex(t *testing.T) {
	cases := []struct {
		expr string
		want string
	}{
		{"j*j", "-1"},
		{"6j", "6j"},
		{"j6", "6j"},
		{"4 + j6", "4 + 6j  (7.2111∠56.3099°)"},
		{"(4+j6) + (3-j2)", "7 + 4j  (8.06226∠29.7449°)"},
		{"(4+j6)(3-j2)", "24 + 10j  (26∠22.6199°)"},
		{"24∠0", "24"},
		{"24∠0°", "24"},
		{"10∠90", "10j"},
		{"3∠45", "2.12132 + 2.12132j  (3∠45°)"},
		{"(24∠0)/(4+j6)", "1.84615 - 2.76923j  (3.3282∠-56.3099°)"},
		{"sqrt(-4)", "2j"},
		{"arg(1+j)", "45"},
		{"re(4+j6)", "4"},
		{"im(4+j6)", "6"},
		{"abs(3+j4)", "5"},
		{"atan2(1, 1)", "45"},
		{"sin(0)", "0"},
		{"sin(30°)", "0.5"},
		{"sin(radians(30))", "0.5"},
		{"cos(pi)", "-1"},
		{"ln(e)", "1"},
		{"2(3+1)", "8"},
		{"2pi", "6.28319"},
		{"(2+3)(4-1)", "15"},
	}
	for _, c := range cases {
		v, err := Eval(c.expr)
		if err != nil {
			t.Errorf("Eval(%q): %v", c.expr, err)
			continue
		}
		if got := v.String(); got != c.want {
			t.Errorf("Eval(%q) = %q, want %q", c.expr, got, c.want)
		}
	}
}

func TestEvalErrors(t *testing.T) {
	cases := []string{
		"1/0",
		"1/(0+0j)",
		"foo(3)",
		"sin(1, 2)",
		"sin()",
		"min(2+j, 3)",
		"(2+3",
		"2 +",
		"",
		"2 3 +",
		"floor(1+j)",
		"2∠(1+j)",
		"0^-2",
	}
	for _, expr := range cases {
		if _, err := Eval(expr); err == nil {
			t.Errorf("Eval(%q) succeeded, want an error", expr)
		}
	}
}

func TestEvalDegreePostfixAfterAngleIsDecorative(t *testing.T) {
	a, err := Eval("5∠30")
	if err != nil {
		t.Fatal(err)
	}
	b, err := Eval("5∠30°")
	if err != nil {
		t.Fatal(err)
	}
	if a.String() != b.String() {
		t.Errorf("5∠30 = %q but 5∠30° = %q; the degree sign should be decorative after ∠", a.String(), b.String())
	}
}

func TestEvalAtBindsTheVariable(t *testing.T) {
	cases := []struct {
		expr string
		x    float64
		want float64
	}{
		{"x^2", 3, 9},
		{"2x + 1", 1.5, 4},
		{"x(x+1)", 2, 6},
		{"exp(-x)", 0, 1},
		{"sin(x)", 0, 0},
		{"x^2*exp(-x)", 1, 1 / 2.718281828459045},
	}
	for _, c := range cases {
		v, err := EvalAt(c.expr, "x", c.x)
		if err != nil {
			t.Fatalf("%s: %v", c.expr, err)
		}
		got, ok := v.Real()
		if !ok || math.Abs(got-c.want) > 1e-9 {
			t.Errorf("%s at %v = %v (%v), want %v", c.expr, c.x, got, ok, c.want)
		}
	}
	if _, err := EvalAt("y + 1", "x", 1); err == nil {
		t.Error("an unbound name should fail")
	}
	v, _ := EvalAt("sqrt(x)", "x", -1)
	if _, ok := v.Real(); ok {
		t.Error("sqrt(-1) is not real")
	}
}

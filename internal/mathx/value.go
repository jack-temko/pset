// Package mathx is the deterministic calculator behind the chat's math
// tools. Arithmetic stays exact (big.Rat) while every operand is rational,
// degrading to complex128 the moment a transcendental function or a complex
// operand appears; on top of it sits a linear-system solver that keeps the
// same exactness rule. It evaluates expression strings the model writes, so
// every failure is a clean sentence the model can read and react to.
package mathx

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"math/cmplx"
	"strconv"
	"strings"
)

// maxExprChars caps one expression; model output is prose-adjacent, not
// code.
const maxExprChars = 4000

// Value is one calculator result: an exact rational while the arithmetic
// stayed rational, otherwise a complex approximation.
type Value struct {
	rat *big.Rat
	c   complex128
}

func ratVal(r *big.Rat) Value { return Value{rat: r} }

func cVal(c complex128) Value { return Value{c: c} }

// IsExact reports whether the value is an exact rational.
func (v Value) IsExact() bool { return v.rat != nil }

// Real is the value as a real number; ok is false when it has an
// imaginary part worth the name, or isn't finite.
func (v Value) Real() (float64, bool) {
	c := v.complex()
	re, im := real(c), imag(c)
	if math.IsNaN(re) || math.IsInf(re, 0) || math.Abs(im) > imagEps(re, im) {
		return 0, false
	}
	return re, true
}

// ratFloat is the float64 view of a rational (this Go's Rat.Float64
// returns an exactness flag we always ignore).
func ratFloat(r *big.Rat) float64 {
	f, _ := r.Float64()
	return f
}

// complex returns the value as complex128, converting an exact rational.
func (v Value) complex() complex128 {
	if v.rat != nil {
		return complex(ratFloat(v.rat), 0)
	}
	return v.c
}

var errDivZero = errors.New("division by zero")

// String renders the value the way a homework answer reads: exact values
// exact ("42", "7/3 ≈ 2.33333"), complex values in rectangular form with
// the polar form appended when both parts are present.
func (v Value) String() string {
	if v.rat != nil {
		if v.rat.IsInt() {
			return v.rat.RatString()
		}
		return v.rat.RatString() + " ≈ " + fmt6(ratFloat(v.rat))
	}
	re, im := real(v.c), imag(v.c)
	if math.IsNaN(re) || math.IsNaN(im) || math.IsInf(re, 0) || math.IsInf(im, 0) {
		return "not a number (out of range)"
	}
	if v.imagIsZero() {
		return fmt6(re)
	}
	if math.Abs(re) <= imagEps(re, im) {
		return fmt6(im) + "j"
	}
	sign := "+"
	if im < 0 {
		sign = "-"
	}
	mag := cmplx.Abs(v.c)
	ang := cmplx.Phase(v.c) * 180 / math.Pi
	return fmt.Sprintf("%s %s %sj  (%s∠%s°)",
		fmt6(re), sign, fmt6(math.Abs(im)), fmt6(mag), fmt6(ang))
}

// imagIsZero reports whether the imaginary part is floating-point residue
// rather than a real component (relative, so it scales with magnitude).
func (v Value) imagIsZero() bool {
	return math.Abs(imag(v.c)) <= imagEps(real(v.c), imag(v.c))
}

func imagEps(re, im float64) float64 {
	return 1e-9 * math.Max(1, math.Max(math.Abs(re), math.Abs(im)))
}

// ExprString renders the value as text Eval itself accepts, so results can
// be substituted back into expressions.
func (v Value) ExprString() string {
	if v.rat != nil {
		return v.rat.RatString()
	}
	re, im := real(v.c), imag(v.c)
	if v.imagIsZero() {
		return fmt6(re)
	}
	if math.Abs(re) <= imagEps(re, im) {
		return fmt6(im) + "j"
	}
	sign := "+"
	if im < 0 {
		sign = "-"
	}
	return fmt.Sprintf("%s%s%sj", fmt6(re), sign, fmt6(math.Abs(im)))
}

// fmt6 formats a float with six significant figures, preferring plain
// decimal notation over exponent form.
func fmt6(f float64) string {
	if f == 0 {
		return "0"
	}
	s := strconv.FormatFloat(f, 'g', 6, 64)
	if strings.ContainsAny(s, "eE") {
		s = strconv.FormatFloat(f, 'f', -1, 64)
	}
	return s
}

func add(a, b Value) Value {
	if a.rat != nil && b.rat != nil {
		return ratVal(new(big.Rat).Add(a.rat, b.rat))
	}
	return cVal(a.complex() + b.complex())
}

func sub(a, b Value) Value {
	if a.rat != nil && b.rat != nil {
		return ratVal(new(big.Rat).Sub(a.rat, b.rat))
	}
	return cVal(a.complex() - b.complex())
}

func neg(a Value) Value {
	if a.rat != nil {
		return ratVal(new(big.Rat).Neg(a.rat))
	}
	return cVal(-a.complex())
}

func mul(a, b Value) Value {
	if a.rat != nil && b.rat != nil {
		return ratVal(new(big.Rat).Mul(a.rat, b.rat))
	}
	return cVal(a.complex() * b.complex())
}

func div(a, b Value) (Value, error) {
	if a.rat != nil && b.rat != nil {
		if b.rat.Sign() == 0 {
			return Value{}, errDivZero
		}
		return ratVal(new(big.Rat).Quo(a.rat, b.rat)), nil
	}
	bc := b.complex()
	if bc == 0 {
		return Value{}, errDivZero
	}
	return cVal(a.complex() / bc), nil
}

// maxExactPower bounds an integer exponent on the exact path: 2^4095 already
// renders thousands of digits, and beyond it the float path is honest.
const maxExactPower = 4095

// pow raises a to b. Exact while both are rational and the exponent is a
// small integer; otherwise complex (principal value, so (-8)^(1/3) is
// 1 + 1.73j, not -2).
func pow(a, b Value) (Value, error) {
	if a.rat != nil && b.rat != nil && b.rat.IsInt() {
		k := b.rat.Num()
		if k.IsInt64() && k.BitLen() <= 12 {
			num, den := a.rat.Num(), a.rat.Denom()
			e := k.Int64()
			if e < 0 {
				if a.rat.Sign() == 0 {
					return Value{}, errors.New("0 cannot be raised to a negative power")
				}
				e = -e
				num, den = den, num // a^-k = (den/num)^k
			}
			if e <= maxExactPower {
				n := new(big.Int).Exp(num, big.NewInt(e), nil)
				d := new(big.Int).Exp(den, big.NewInt(e), nil)
				return ratVal(new(big.Rat).SetFrac(n, d)), nil
			}
		}
	}
	c := cmplx.Pow(a.complex(), b.complex())
	if cmplx.IsNaN(c) || cmplx.IsInf(c) {
		return Value{}, errors.New("that power is out of range")
	}
	return cVal(c), nil
}

// polar builds r∠θ with θ in degrees, the phasor convention.
func polar(r, theta Value) (Value, error) {
	tc := theta.complex()
	if imag(tc) != 0 {
		return Value{}, errors.New("the angle after ∠ must be real (degrees)")
	}
	mag := cmplx.Abs(r.complex()) // |r|: a negative magnitude is still a length
	return cVal(complex(mag, 0) * cmplx.Exp(complex(0, real(tc)*math.Pi/180))), nil
}

// isSquare reports whether a non-negative big.Int is a perfect square.
func isSquare(i *big.Int) bool {
	if i.Sign() < 0 {
		return false
	}
	s := new(big.Int).Sqrt(i)
	sq := new(big.Int).Mul(s, s)
	return sq.Cmp(i) == 0
}

// sqrtVal stays exact for perfect squares of non-negative rationals; every
// other case goes complex.
func sqrtVal(v Value) Value {
	if v.rat != nil && v.rat.Sign() >= 0 &&
		isSquare(v.rat.Num()) && isSquare(v.rat.Denom()) {
		return ratVal(new(big.Rat).SetFrac(
			new(big.Int).Sqrt(v.rat.Num()),
			new(big.Int).Sqrt(v.rat.Denom())))
	}
	return cVal(cmplx.Sqrt(v.complex()))
}

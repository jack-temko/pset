package mathx

import (
	"fmt"
	"math"
	"math/big"
	"math/cmplx"
)

// Eval parses and evaluates one expression.
//
// Grammar (highest binding last):
//
//	add    := mul (('+' | '-') mul)*
//	mul    := angle (('*' | '/') angle | operand)*   // juxtaposition multiplies
//	angle  := unary ('∠' unary ('°')?)?              // ∠ angles are degrees
//	unary  := ('+' | '-') unary | postfix
//	postfix:= pow ('°')*                             // 30° is radians(30)
//	pow    := atom ('^' unary)?                      // right-assoc
//	atom   := number | j6 | name | name '(' args ')' | '(' add ')'
//
// Trigonometry takes radians; write sin(30°) or sin(radians(30)) for
// degrees. The imaginary unit is j (i accepted): j6, 6j, and 6*j all work.
func Eval(expr string) (Value, error) {
	tokens, err := lex(expr)
	if err != nil {
		return Value{}, err
	}
	p := &parser{tokens: tokens}
	v, err := p.add()
	if err != nil {
		return Value{}, err
	}
	if t := p.peek(); t.kind != tokEOF {
		return Value{}, fmt.Errorf("unexpected %q after the end of the expression", t.text)
	}
	return v, nil
}

type parser struct {
	tokens []token
	pos    int
}

func (p *parser) peek() token { return p.tokens[p.pos] }

func (p *parser) next() token {
	t := p.tokens[p.pos]
	if t.kind != tokEOF {
		p.pos++
	}
	return t
}

func (p *parser) atOp(op string) bool {
	t := p.peek()
	return t.kind == tokOp && t.text == op
}

// startsOperand reports whether the upcoming token can open an operand,
// which makes juxtaposition a multiplication.
func (p *parser) startsOperand() bool {
	t := p.peek()
	return t.kind == tokNumber || t.kind == tokIdent || (t.kind == tokOp && t.text == "(")
}

func (p *parser) add() (Value, error) {
	left, err := p.mul()
	if err != nil {
		return Value{}, err
	}
	for {
		switch {
		case p.atOp("+"):
			p.next()
			right, err := p.mul()
			if err != nil {
				return Value{}, err
			}
			left = add(left, right)
		case p.atOp("-"):
			p.next()
			right, err := p.mul()
			if err != nil {
				return Value{}, err
			}
			left = sub(left, right)
		default:
			return left, nil
		}
	}
}

func (p *parser) mul() (Value, error) {
	left, err := p.angle()
	if err != nil {
		return Value{}, err
	}
	for {
		switch {
		case p.atOp("*"):
			p.next()
			right, err := p.angle()
			if err != nil {
				return Value{}, err
			}
			left = mul(left, right)
		case p.atOp("/"):
			p.next()
			right, err := p.angle()
			if err != nil {
				return Value{}, err
			}
			if left, err = div(left, right); err != nil {
				return Value{}, err
			}
		case p.startsOperand(): // (4+j6)(3-j2), 2pi, 6j, 2(3+1)
			right, err := p.angle()
			if err != nil {
				return Value{}, err
			}
			left = mul(left, right)
		default:
			return left, nil
		}
	}
}

// angle parses the ∠ operator: r∠θ builds the phasor with θ in degrees. A
// degree sign right after the angle is decorative (the angle already is in
// degrees), so the right operand goes through angleOperand rather than the
// general postfix that would convert 30° to radians.
func (p *parser) angle() (Value, error) {
	left, err := p.unary()
	if err != nil {
		return Value{}, err
	}
	if !p.atOp("∠") {
		return left, nil
	}
	p.next()
	right, err := p.angleOperand()
	if err != nil {
		return Value{}, err
	}
	return polar(left, right)
}

// angleOperand is unary for the ∠'s right side: minus chains and powers
// apply, trailing degree signs are consumed as decoration.
func (p *parser) angleOperand() (Value, error) {
	if p.atOp("-") {
		p.next()
		v, err := p.angleOperand()
		if err != nil {
			return Value{}, err
		}
		return neg(v), nil
	}
	if p.atOp("+") {
		p.next()
		return p.angleOperand()
	}
	v, err := p.pow()
	if err != nil {
		return Value{}, err
	}
	for p.atOp("°") {
		p.next()
	}
	return v, nil
}

func (p *parser) unary() (Value, error) {
	if p.atOp("-") {
		p.next()
		v, err := p.unary()
		if err != nil {
			return Value{}, err
		}
		return neg(v), nil
	}
	if p.atOp("+") {
		p.next()
		return p.unary()
	}
	return p.postfix()
}

// postfix applies the degree conversion: 30° is radians(30), so
// sin(30°) = 0.5.
func (p *parser) postfix() (Value, error) {
	v, err := p.pow()
	if err != nil {
		return Value{}, err
	}
	for p.atOp("°") {
		p.next()
		v = cVal(v.complex() * (math.Pi / 180))
	}
	return v, nil
}

func (p *parser) pow() (Value, error) {
	base, err := p.atom()
	if err != nil {
		return Value{}, err
	}
	if !p.atOp("^") {
		return base, nil
	}
	p.next()
	exp, err := p.unary()
	if err != nil {
		return Value{}, err
	}
	return pow(base, exp)
}

func (p *parser) atom() (Value, error) {
	t := p.next()
	switch t.kind {
	case tokNumber:
		if t.imag {
			return cVal(complex(0, ratFloat(t.num))), nil
		}
		return ratVal(t.num), nil
	case tokIdent:
		if p.atOp("(") {
			return p.call(t.text)
		}
		if v, ok := constants[t.text]; ok {
			return v, nil
		}
		return Value{}, fmt.Errorf("%q is not defined here", t.text)
	case tokOp:
		if t.text != "(" {
			return Value{}, fmt.Errorf("expected a value, found %q", t.text)
		}
		v, err := p.add()
		if err != nil {
			return Value{}, err
		}
		if !p.atOp(")") {
			return Value{}, fmt.Errorf("missing ) in the expression")
		}
		p.next()
		return v, nil
	default:
		return Value{}, fmt.Errorf("expected a value, found the end of the expression")
	}
}

func (p *parser) call(name string) (Value, error) {
	p.next() // consume '('
	fn, ok := functions[name]
	if !ok {
		return Value{}, fmt.Errorf("%q is not defined here", name)
	}
	var args []Value
	if !p.atOp(")") {
		for {
			v, err := p.add()
			if err != nil {
				return Value{}, err
			}
			args = append(args, v)
			if p.atOp(",") {
				p.next()
				continue
			}
			break
		}
	}
	if !p.atOp(")") {
		return Value{}, fmt.Errorf("missing ) after %s(...)", name)
	}
	p.next()
	if fn.arity >= 0 && len(args) != fn.arity {
		return Value{}, fmt.Errorf("%s takes %d argument%s, got %d",
			name, fn.arity, plural(fn.arity), len(args))
	}
	if fn.arity < 0 && len(args) == 0 {
		return Value{}, fmt.Errorf("%s needs at least one argument", name)
	}
	return fn.fn(args)
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

// constants are the named scalars.
var constants = map[string]Value{
	"j":   cVal(1i),
	"i":   cVal(1i),
	"e":   cVal(complex(math.E, 0)),
	"pi":  cVal(complex(math.Pi, 0)),
	"tau": cVal(complex(2*math.Pi, 0)),
}

type function struct {
	arity int // -1 means one or more
	fn    func(args []Value) (Value, error)
}

// real1 unwraps a one-argument function that needs a real input.
func real1(name string, args []Value) (float64, error) {
	c := args[0].complex()
	if imag(c) != 0 {
		return 0, fmt.Errorf("%s needs a real argument", name)
	}
	return real(c), nil
}

// realOrRat picks the real value out of args[0], keeping exactness when the
// value stayed rational.
func realOrRat(name string, v Value) (*big.Rat, error) {
	if v.rat != nil {
		return v.rat, nil
	}
	if imag(v.c) != 0 {
		return nil, fmt.Errorf("%s needs a real argument", name)
	}
	return new(big.Rat).SetFloat64(real(v.c)), nil
}

var functions = map[string]function{
	"sqrt": {1, func(a []Value) (Value, error) { return sqrtVal(a[0]), nil }},
	"cbrt": {1, func(a []Value) (Value, error) {
		c := a[0].complex()
		if imag(c) == 0 {
			return cVal(complex(math.Cbrt(real(c)), 0)), nil
		}
		return cVal(cmplx.Exp(cmplx.Log(c) / 3)), nil
	}},
	"exp":  {1, func(a []Value) (Value, error) { return cVal(cmplx.Exp(a[0].complex())), nil }},
	"ln":   {1, func(a []Value) (Value, error) { return cVal(cmplx.Log(a[0].complex())), nil }},
	"log":  {1, func(a []Value) (Value, error) { return cVal(complex(math.Log10(real(a[0].complex())), 0)), nil }},
	"log2": {1, func(a []Value) (Value, error) { return cVal(complex(math.Log2(real(a[0].complex())), 0)), nil }},
	"abs":  {1, func(a []Value) (Value, error) { return absVal(a[0]), nil }},
	"arg":  {1, func(a []Value) (Value, error) { return cVal(complex(argDegrees(a[0]), 0)), nil }},
	"conj": {1, func(a []Value) (Value, error) { return cVal(complex(real(a[0].complex()), -imag(a[0].complex()))), nil }},
	"re":   {1, func(a []Value) (Value, error) { return reIm(a[0], true), nil }},
	"im":   {1, func(a []Value) (Value, error) { return reIm(a[0], false), nil }},
	"real": {1, func(a []Value) (Value, error) { return reIm(a[0], true), nil }},
	"imag": {1, func(a []Value) (Value, error) { return reIm(a[0], false), nil }},
	"sin":  {1, trig("sin", cmplx.Sin)},
	"cos":  {1, trig("cos", cmplx.Cos)},
	"tan":  {1, trig("tan", cmplx.Tan)},
	"asin": {1, trig("asin", cmplx.Asin)},
	"acos": {1, trig("acos", cmplx.Acos)},
	"atan": {1, trig("atan", cmplx.Atan)},
	"sinh": {1, trig("sinh", cmplx.Sinh)},
	"cosh": {1, trig("cosh", cmplx.Cosh)},
	"tanh": {1, trig("tanh", cmplx.Tanh)},
	"atan2": {2, func(a []Value) (Value, error) {
		y, err := real1("atan2", a[:1])
		if err != nil {
			return Value{}, err
		}
		x, err := real1("atan2", a[1:])
		if err != nil {
			return Value{}, err
		}
		return cVal(complex(math.Atan2(y, x)*180/math.Pi, 0)), nil
	}},
	"floor": {1, roundFunc("floor", math.Floor)},
	"ceil":  {1, roundFunc("ceil", math.Ceil)},
	"round": {1, roundFunc("round", math.Round)},
	"min":   {-1, minMax("min", true)},
	"max":   {-1, minMax("max", false)},
	"radians": {1, func(a []Value) (Value, error) {
		return cVal(a[0].complex() * (math.Pi / 180)), nil
	}},
	"degrees": {1, func(a []Value) (Value, error) {
		return cVal(a[0].complex() * (180 / math.Pi)), nil
	}},
}

func trig(name string, fn func(complex128) complex128) func([]Value) (Value, error) {
	return func(a []Value) (Value, error) {
		c := fn(a[0].complex())
		if cmplx.IsNaN(c) {
			return Value{}, fmt.Errorf("%s is not defined for that argument", name)
		}
		return cVal(c), nil
	}
}

func roundFunc(name string, f func(float64) float64) func([]Value) (Value, error) {
	return func(a []Value) (Value, error) {
		r, err := realOrRat(name, a[0])
		if err != nil {
			return Value{}, err
		}
		// f of a float64 integer is exact, and floor/ceil/round land there.
		return ratVal(new(big.Rat).SetFloat64(f(ratFloat(r)))), nil
	}
}

func minMax(name string, wantMin bool) func([]Value) (Value, error) {
	return func(a []Value) (Value, error) {
		best, err := realOrRat(name, a[0])
		if err != nil {
			return Value{}, err
		}
		for _, v := range a[1:] {
			r, err := realOrRat(name, v)
			if err != nil {
				return Value{}, err
			}
			if (wantMin && r.Cmp(best) < 0) || (!wantMin && r.Cmp(best) > 0) {
				best = r
			}
		}
		return ratVal(new(big.Rat).Set(best)), nil
	}
}

func absVal(v Value) Value {
	if v.rat != nil {
		return ratVal(new(big.Rat).Abs(v.rat))
	}
	return cVal(complex(cmplx.Abs(v.c), 0))
}

// argDegrees is the phasor angle of a value, in degrees.
func argDegrees(v Value) float64 {
	if v.rat != nil {
		if v.rat.Sign() < 0 {
			return 180
		}
		return 0
	}
	return cmplx.Phase(v.c) * 180 / math.Pi
}

func reIm(v Value, realPart bool) Value {
	c := v.complex()
	if realPart {
		return cVal(complex(real(c), 0))
	}
	return cVal(complex(imag(c), 0))
}

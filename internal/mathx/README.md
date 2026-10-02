# mathx

The deterministic calculator behind the chat tools `calc` and
`solve_linear`. No dependencies outside the standard library.

## Contract

- `Eval(expr) (Value, error)` parses and evaluates one expression string
  the model wrote. Arithmetic on rationals is exact (`big.Rat`,
  `7/3` stays `7/3`); any transcendental function or complex operand
  drops the value to `complex128`.
- `Value.String()` renders the homework-readable form: exact integers,
  `p/q ≈ decimal` for fractions, `a + bj  (mag∠angle°)` for complex
  values.
- `SolveLinear(a [][]string, b []string)` solves `A·x = b` where every
  entry is itself a calc expression. All-rational systems solve exactly;
  one complex entry drops the whole solve to complex128. Singular systems
  are an error, never a zero row.

## Conventions (also stated in the tool descriptions)

- Imaginary unit is `j` (`i` accepted): `j6`, `6j`, `6*j` all work, and
  juxtaposition multiplies (`(4+j6)(3-j2)`, `2pi`).
- `∠` angles are degrees; trigonometry takes radians; `30°` as a postfix
  converts to radians, so `sin(30°)` and `sin(radians(30))` both work.
  `arg()` and `atan2()` return degrees.
- Powers with integer exponents stay exact; anything else takes the
  complex principal value (`(-8)^(1/3)` is `1 + 1.73j`, not `-2`).

## Consumers

`internal/agent` binds these to the chat tool loop (`tools.go`), and
`internal/cards` uses them to check worked steps; nothing else imports
this package.

package mathx

import (
	"fmt"
	"math"
	"math/big"
	"math/cmplx"
)

// maxSystemSize bounds solve_linear: mesh and nodal systems are a handful
// of unknowns, and the cap keeps a malformed call cheap.
const maxSystemSize = 10

// SolveLinear solves A·x = b. Entries are calc expressions, so a row may
// read ["4+j6", "-j2"]. While every entry stays an exact rational the whole
// elimination runs on big.Rat and the solutions are exact; one complex
// entry anywhere drops the system to complex128.
func SolveLinear(a [][]string, b []string) ([]Value, error) {
	n := len(b)
	if n == 0 {
		return nil, fmt.Errorf("the system is empty")
	}
	if len(a) != n {
		return nil, fmt.Errorf("the matrix has %d rows but the right side has %d entries", len(a), n)
	}
	if n > maxSystemSize {
		return nil, fmt.Errorf("systems are limited to %d unknowns", maxSystemSize)
	}

	allRat := true
	A := make([][]Value, n)
	for i := 0; i < n; i++ {
		if len(a[i]) != n {
			return nil, fmt.Errorf("row %d has %d entries, expected %d", i+1, len(a[i]), n)
		}
		A[i] = make([]Value, n)
		for j := 0; j < n; j++ {
			v, err := Eval(a[i][j])
			if err != nil {
				return nil, fmt.Errorf("matrix entry %d,%d: %v", i+1, j+1, err)
			}
			A[i][j] = v
			if v.rat == nil {
				allRat = false
			}
		}
	}
	B := make([]Value, n)
	for i := 0; i < n; i++ {
		v, err := Eval(b[i])
		if err != nil {
			return nil, fmt.Errorf("right side entry %d: %v", i+1, err)
		}
		B[i] = v
		if v.rat == nil {
			allRat = false
		}
	}

	if allRat {
		return solveRational(A, B, n)
	}
	return solveComplex(A, B, n)
}

var errSingular = fmt.Errorf("this system has no unique solution (singular matrix)")

// solveRational runs Gaussian elimination with partial pivoting on exact
// rationals. Pivoting is about determinism here, not stability — exact
// arithmetic does not round.
func solveRational(A [][]Value, B []Value, n int) ([]Value, error) {
	a := make([][]*big.Rat, n)
	for i := range a {
		a[i] = make([]*big.Rat, n)
		for j := range a[i] {
			a[i][j] = A[i][j].rat
		}
	}
	b := make([]*big.Rat, n)
	for i := range b {
		b[i] = B[i].rat
	}
	for col := 0; col < n; col++ {
		pivot := pickPivot(a, col, n)
		if pivot < 0 {
			return nil, errSingular
		}
		a[col], a[pivot] = a[pivot], a[col]
		b[col], b[pivot] = b[pivot], b[col]
		for row := col + 1; row < n; row++ {
			if a[row][col].Sign() == 0 {
				continue
			}
			factor := new(big.Rat).Quo(a[row][col], a[col][col])
			for j := col; j < n; j++ {
				a[row][j] = new(big.Rat).Sub(a[row][j], new(big.Rat).Mul(factor, a[col][j]))
			}
			b[row] = new(big.Rat).Sub(b[row], new(big.Rat).Mul(factor, b[col]))
		}
	}
	x := make([]*big.Rat, n)
	for i := n - 1; i >= 0; i-- {
		sum := new(big.Rat)
		for j := i + 1; j < n; j++ {
			sum.Add(sum, new(big.Rat).Mul(x[j], a[i][j]))
		}
		if a[i][i].Sign() == 0 {
			return nil, errSingular
		}
		x[i] = new(big.Rat).Quo(new(big.Rat).Sub(b[i], sum), a[i][i])
	}
	out := make([]Value, n)
	for i := range x {
		out[i] = ratVal(x[i])
	}
	return out, nil
}

// pickPivot chooses the row with the largest magnitude in column col at or
// below the diagonal; -1 when the whole column is zero.
func pickPivot(a [][]*big.Rat, col, n int) int {
	best := -1
	var bestMag float64
	for row := col; row < n; row++ {
		mag := math.Abs(ratFloat(a[row][col]))
		if mag > bestMag {
			bestMag = mag
			best = row
		}
	}
	return best
}

// solveComplex runs Gaussian elimination with partial pivoting on
// complex128.
func solveComplex(A [][]Value, B []Value, n int) ([]Value, error) {
	a := make([][]complex128, n)
	for i := range a {
		a[i] = make([]complex128, n)
		for j := range a[i] {
			a[i][j] = A[i][j].complex()
		}
	}
	b := make([]complex128, n)
	for i := range b {
		b[i] = B[i].complex()
	}
	for col := 0; col < n; col++ {
		pivot := col
		best := math.Abs(cmplx.Abs(a[col][col]))
		for row := col + 1; row < n; row++ {
			if mag := math.Abs(cmplx.Abs(a[row][col])); mag > best {
				best = mag
				pivot = row
			}
		}
		if best < 1e-12 {
			return nil, errSingular
		}
		a[col], a[pivot] = a[pivot], a[col]
		b[col], b[pivot] = b[pivot], b[col]
		for row := col + 1; row < n; row++ {
			factor := a[row][col] / a[col][col]
			if factor == 0 {
				continue
			}
			for j := col; j < n; j++ {
				a[row][j] -= factor * a[col][j]
			}
			b[row] -= factor * b[col]
		}
	}
	x := make([]complex128, n)
	for i := n - 1; i >= 0; i-- {
		var sum complex128
		for j := i + 1; j < n; j++ {
			sum += x[j] * a[i][j]
		}
		x[i] = (b[i] - sum) / a[i][i]
	}
	out := make([]Value, n)
	for i := range x {
		out[i] = cVal(x[i])
	}
	return out, nil
}

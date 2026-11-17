package doc

import "github.com/jackt/pset/internal/pagenum"

// Text is a string a person or an OCR read (a statement, a professor's
// note, a line of a figure's reading) as stored runs: split, with any math
// KaTeX can't parse marked raw so it shows as its source. No model is
// asked to repair it: it isn't the model's writing.
func Text(s string, pages pagenum.Map) []Run {
	runs := Split(s, pages)
	for i := range runs {
		if runs[i].M != "" && MathError(runs[i].M, runs[i].D) != "" {
			runs[i].Raw = true
		}
	}
	return runs
}

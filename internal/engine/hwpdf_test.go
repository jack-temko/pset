package engine

import (
	"math"
	"testing"
)

// TestFigureLayout pins the diagram block's plan at the scale knobs: the
// box is the column share and baseline height multiplied together, wide
// boxes wrap onto extra rows, and the footprint accounts for every row and
// gap — the numbers the working-space budget is subtracted from.
func TestFigureLayout(t *testing.T) {
	cases := []struct {
		name               string
		n                  int
		scale              float64
		wantBoxW           float64
		wantBoxH           float64
		wantPerRow, wantRs int
		wantFootprint      float64
	}{
		// The designed layout: three figures share the row at 100%.
		{n: 3, scale: 1.0, wantBoxW: (sheetContentW - 2*diagramGap) / 3,
			wantBoxH: diagramBaseH, wantPerRow: 3, wantRs: 1, wantFootprint: diagramBaseH},
		// One figure owns the row; twice as tall, twice as wide.
		{n: 1, scale: 2.0, wantBoxW: sheetContentW,
			wantBoxH: 2 * diagramBaseH, wantPerRow: 1, wantRs: 1, wantFootprint: 2 * diagramBaseH},
		// Two figures at 150% no longer fit side by side: one per row,
		// two rows, one inter-row gap in the footprint.
		{n: 2, scale: 1.5, wantBoxW: ((sheetContentW - diagramGap) / 2) * 1.5,
			wantBoxH: 1.5 * diagramBaseH, wantPerRow: 1, wantRs: 2,
			wantFootprint: 2*1.5*diagramBaseH + diagramGap},
		// Shrinking never wraps: two figures at half size share the row.
		{n: 2, scale: 0.5, wantBoxW: ((sheetContentW - diagramGap) / 2) * 0.5,
			wantBoxH: 0.5 * diagramBaseH, wantPerRow: 2, wantRs: 1,
			wantFootprint: 0.5 * diagramBaseH},
	}
	for _, c := range cases {
		boxW, boxH, footprint, perRow := figureLayout(c.n, c.scale)
		rows := (c.n + perRow - 1) / perRow
		if math.Abs(boxW-c.wantBoxW) > 0.01 || math.Abs(boxH-c.wantBoxH) > 0.01 ||
			perRow != c.wantPerRow || rows != c.wantRs || math.Abs(footprint-c.wantFootprint) > 0.01 {
			t.Errorf("%s: n=%d scale=%.1f = box %.1fx%.1f, %d/row, %d rows, footprint %.1f — want box %.1fx%.1f, %d/row, %d rows, footprint %.1f",
				c.name, c.n, c.scale, boxW, boxH, perRow, rows, footprint,
				c.wantBoxW, c.wantBoxH, c.wantPerRow, c.wantRs, c.wantFootprint)
		}
	}
}

// TestFigureLayoutNeverExceedsTheRow guards the cap: a box can never be
// wider than the content width, and every plan places at least one figure
// per row.
func TestFigureLayoutNeverExceedsTheRow(t *testing.T) {
	for _, n := range []int{1, 2, 3} {
		for _, scale := range []float64{0.5, 1.0, 1.5, 2.0} {
			boxW, _, footprint, perRow := figureLayout(n, scale)
			if boxW > sheetContentW+0.01 {
				t.Errorf("n=%d scale=%.1f boxW=%.1f exceeds the row", n, scale, boxW)
			}
			if perRow < 1 || perRow > n {
				t.Errorf("n=%d scale=%.1f perRow=%d, want 1..n", n, scale, perRow)
			}
			if footprint <= 0 {
				t.Errorf("n=%d scale=%.1f footprint=%.1f, want positive", n, scale, footprint)
			}
		}
	}
}

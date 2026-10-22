import { useState } from 'react';

/** The hairline between two sides (divider-d1): 1px, the accent while hovered
 *  or dragged, and a double click puts it back to half and half. The parent
 *  turns the pointer's x into a split and holds it to each side's minimum. */
export function Divider({
  onMove,
  onReset,
  forceState,
}: {
  /** The pointer's x in window coordinates, while dragging. */
  onMove: (clientX: number) => void;
  onReset: () => void;
  /** Draws the hover or drag look without either (the design page only). */
  forceState?: 'hover' | 'drag';
}) {
  const [dragging, setDragging] = useState(false);
  const lit = dragging || forceState !== undefined;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={`relative w-px shrink-0 hover:bg-(--ds-accent) ${lit ? 'bg-(--ds-accent)' : 'bg-(--ds-border-muted)'}`}
    >
      {/* A wider hit area than the line, so it is easy to take. */}
      <div
        className="absolute inset-y-0 -left-1 z-10 w-[9px] cursor-col-resize touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (dragging) onMove(e.clientX);
        }}
        onPointerUp={() => {
          setDragging(false);
        }}
        onPointerCancel={() => {
          setDragging(false);
        }}
        onDoubleClick={onReset}
      />
    </div>
  );
}

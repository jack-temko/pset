/** A bar where text will be (bone-d1). It is one line of the text style it
 *  sits in and has no height of its own, so it cannot size a box; its width
 *  is in ch and never passes its slot. The only place a bar is drawn. */
export function Bone({
  ch,
  pill,
  still,
}: {
  /** The width in ch. */
  ch: number;
  /** A tag's or a counter's shape: a full-height rounded bar. */
  pill?: boolean;
  /** No pulse: a wait that is work in progress (Finding, a page drawing). */
  still?: boolean;
}) {
  return (
    <span
      aria-hidden
      data-bone
      className={`ds-bone ${pill === true ? 'ds-bone-pill' : ''} ${still === true ? 'ds-bone-still' : ''}`}
      style={{ width: `${String(ch)}ch` }}
    />
  );
}

/** For what is not text (a chart, a page): fills the box its parent made,
 *  and adds no size of its own. */
export function BoneBlock({ still }: { still?: boolean }) {
  return (
    <span
      aria-hidden
      data-bone
      className={`ds-bone-block ${still === true ? 'ds-bone-still' : ''}`}
    />
  );
}

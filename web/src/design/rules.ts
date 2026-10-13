/** One rule of the rulebook. The id is permanent: specs cite it, so it is
 *  never renamed or reused, only superseded in the rule text. */
export interface Rule {
  id: string;
  /** One sentence. */
  rule: string;
  /** How anyone can tell the rule is kept. */
  check: string;
  /** Which units it binds: "all", a kind, or a unit id. */
  scope: string;
  /** What fails when it is broken, if anything enforces it. */
  enforcedBy?: string;
}

/** The rulebook. Empty on purpose: rules are written as each thing is
 *  designed (D13, D24). */
export const RULES: readonly Rule[] = [];

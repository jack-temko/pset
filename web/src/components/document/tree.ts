import type { Block, PartBlock, StepBlock } from '@/api/gen/doc';
import { must } from '@/lib/must';

/**
 * A document is a flat list of blocks; `part` and `step` are markers like
 * headings, and everything after one belongs to it until the next. This
 * builds the tree the page is drawn from: parts hold steps, steps hold
 * blocks, and steps are numbered from 1, starting over in each part.
 *
 * Blocks before the first part sit in a lead section with no part, and
 * blocks before a part's first step in a group with no step. Each block
 * carries its index in the flat list, which is where a step feed or a
 * skeleton belongs.
 */
export type Item = { block: Block; index: number };

export type Group = {
  step?: StepBlock;
  /** Steps count from 1 in each part; 0 when there is no step. */
  number: number;
  /** Where the group starts in the flat list (its step marker, if any). */
  index: number;
  items: Item[];
};

export type Section = {
  part?: PartBlock;
  /** Where the section starts in the flat list (its part marker, if any). */
  index: number;
  groups: Group[];
};

export function buildTree(blocks: Block[]): Section[] {
  const sections: Section[] = [];
  let section: Section | undefined;
  let group: Group | undefined;
  let steps = 0;
  const newGroup = (index: number, step?: StepBlock): Group => {
    const made: Group = { step, number: step ? ++steps : 0, index, items: [] };
    group = made;
    must(section, 'the section').groups.push(made);
    return made;
  };
  blocks.forEach((block, index) => {
    if (block.type === 'part') {
      section = { part: block, index, groups: [] };
      sections.push(section);
      group = undefined;
      steps = 0;
      return;
    }
    if (!section) {
      section = { index, groups: [] };
      sections.push(section);
    }
    if (block.type === 'step') {
      newGroup(index, block);
      return;
    }
    (group ?? newGroup(index)).items.push({ block, index });
  });
  return sections;
}

/** The answer blocks, in order: what the Answers veil collects. */
export function answersOf(blocks: Block[]) {
  return blocks.flatMap((b) => (b.type === 'answer' ? [b] : []));
}

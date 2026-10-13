/** What PSet is, as plain data (`ideas/vision-grill.md`, V1 to V4, V8, V14).
 *  One line each, within `LINE_MAX`. The Rules tab shows it above the rules. */
export interface Vision {
  /** What PSet is. */
  line: string;
  /** The facts, in order: a label and one line. */
  facts: readonly { label: string; text: string }[];
}

export const VISION: Vision = {
  line: "A study tool for problem-set courses: it walks you through this week's work until you can do it yourself, from your own course's materials.",
  facts: [
    {
      label: 'Who it is for',
      text: "Jack and students like him: university students in problem-set courses who have their course's PDFs and can run a local app.",
    },
    {
      label: 'The job',
      text: "Get this week's work done, understanding it. Reading and asking serve the work.",
    },
    {
      label: 'The centre',
      text: 'The course: it holds its materials and its work.',
    },
    {
      label: 'The student',
      text: 'An ordinary student, maybe a bit tired. Not the worst case.',
    },
    {
      label: 'It is not',
      text: 'A notes app, a general chatbot or a memorisation tool. Not a planner, but it shows due dates it was given or found.',
    },
    {
      label: 'The feel, reading',
      text: 'A quiet study room where the student reads: serif for the greeting, the problem and the help.',
    },
    {
      label: 'The feel, acting',
      text: 'A precise tool where they act: ruled rows, figures in the font of their text, compact controls, one accent.',
    },
  ],
};

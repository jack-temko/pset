import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'top-bar',
  kind: 'component',
  title: 'Top bar',
  group: 'Navigation',
  purpose:
    'The top of every screen: the wordmark that goes Home, where you are as a path of links, and Settings.',
  states: [
    {
      id: 'home',
      name: 'Home',
      when: 'On Home: the path is empty.',
    },
    {
      id: 'course',
      name: 'Course',
      when: 'On a course: one item, which is where you are.',
    },
    {
      id: 'workspace',
      name: 'Workspace',
      when: 'On a set in the workspace: the course links back, the set is where you are.',
    },
  ],
  stress:
    'A 70 character course, a 70 character set and a 40 character material in a 1024px container: the middle truncates first; the wordmark and Settings never move.',
  components: [
    { unit: 'link', use: 'The path items and Settings, standing alone.' },
  ],
  actions: [
    {
      id: 'go-home',
      label: 'PSet',
      key: 'Enter',
      does: 'Goes Home. Home is not a unit yet, so it has no target.',
    },
    {
      id: 'go-up',
      label: 'A path item',
      key: 'Enter',
      does: 'Goes to that level. Every item but the last is a link; the screens are not units yet, so it has no target.',
    },
    {
      id: 'open-settings',
      label: 'Settings',
      key: 'Enter',
      does: 'Opens Settings. Settings is not a unit yet, so it has no target.',
    },
  ],
  inputs: [
    {
      name: 'homeHref',
      type: 'string',
      default: 'none',
      does: 'Where the wordmark goes: Home.',
    },
    {
      name: 'path',
      type: '{ label: string; href?: string }[]',
      default: '[]',
      does: 'Where you are, outermost first. The last item is not a link.',
    },
    {
      name: 'settingsHref',
      type: 'string',
      default: 'none',
      does: 'Where Settings goes.',
    },
  ],
  priority: {
    first: 'Where you are, the last item of the path.',
  },
  sizes: {
    narrowest: 480,
    gives: [
      'The middle items of the path truncate first',
      'Then the first and last items',
      'The wordmark and Settings never move',
    ],
  },
  exampleWidth: 'full',
  rules: {
    cite: [
      'course-first',
      'links-go-buttons-do',
      'serif-to-read',
      'sentence-case',
    ],
  },
  log: 'web/src/units/top-bar/log.md',
  decisions: [
    {
      id: 'top-bar-d1',
      decision:
        'The wordmark (goes Home), where you are as a path of links, and Settings at the right; nothing else until a screen needs it.',
      why: 'Enough to know where you are and go up.',
      beat: 'An activity indicator; wordmark and Settings only',
      date: '2026-10-13',
    },
  ],
});

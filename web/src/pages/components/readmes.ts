/** Every component folder's README, loaded the first time it is asked for. */
export const READMES = import.meta.glob('/src/components/*/README.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

export const readmePath = (name: string) => `/src/components/${name}/README.md`;

/** Which of these component folders have a README to show. */
export const withDocs = (names: readonly string[] | undefined) =>
  (names ?? []).filter((n) => readmePath(n) in READMES);

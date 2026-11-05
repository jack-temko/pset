# Error notice

purpose: see how PSet says something went wrong, in each place it says it: inline where it happened, in the shelf's row, as the screen's one banner, as a field's single line, and in Settings' list of kept errors. The real components on sample data; the words are the error catalog's (`design/errors.md`).

where: `/views/error-notice`, one scenario per state. Code: `web/src/views/error-notice/`; the components are `web/src/components/error-notice`, `import-row`, the shell's `UnreachableBanner` and `web/src/pages/settings/errors.tsx`.

The sample failure: importing "Calculus" failed. Chain `import.failed`, `key.out_of_credit`, incident `E7K2QF`.

- **What** is the outer entry's, **why** and **fix** the deepest cause's (the account is out of credit), the button that cause's action.
- A failure of the whole screen is the banner, never a notice as well.
- A field's error is one line, nothing more.
- Details is closed; it opens the ids and the incident, with Copy.

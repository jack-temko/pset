import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';
import { followSystem } from './lib/theme';
import { queryClient } from './api/query';
import { must } from '@/lib/must';

followSystem();

// Every font starts loading now, not when something first uses it: a font
// that arrives after first paint reflows what is already on screen (the first
// table in JetBrains Mono did). The sample has a letter from the latin and
// latin-ext subsets, the ones the app's text and figures use; the rest (Greek,
// Cyrillic, Vietnamese) load on first use. Not awaited.
for (const family of [
  'Inter Variable',
  'Newsreader Variable',
  'JetBrains Mono Variable',
]) {
  void document.fonts.load(`1em "${family}"`, 'AaĀ').catch(() => {});
}

// The same for KaTeX's: a formula's glyphs come from these, and a pane that is
// mounted hidden (Ask behind Homework) only asks for them when it is first
// shown, so its math would reflow once they arrived. The faces the models'
// formulas use: the text and math faces, the delimiter sizes, the AMS symbols.
for (const face of [
  '1em KaTeX_Main',
  'bold 1em KaTeX_Main',
  'italic 1em KaTeX_Main',
  'italic 1em KaTeX_Math',
  '1em KaTeX_AMS',
  '1em KaTeX_Size1',
  '1em KaTeX_Size2',
  '1em KaTeX_Size3',
  '1em KaTeX_Size4',
  '1em KaTeX_Caligraphic',
  '1em KaTeX_Script',
  '1em KaTeX_SansSerif',
]) {
  void document.fonts.load(face, 'x2+(').catch(() => {});
}

createRoot(must(document.getElementById('root'), '#root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

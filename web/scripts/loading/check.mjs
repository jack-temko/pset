// The box proof (make loading-check; ideas/skeleton-plan.md, layer B). Opens
// /design/loading in Chromium for the units on the loading contract, and
// fails on any state whose loading form is not the size of the loaded one.
// It finds those units itself: nothing to list or update when one is added
// or converted.
//
//   node scripts/loading/check.mjs <base url> [--shot <png>]
import { chromium } from 'playwright';

const base = process.argv[2];
if (!base) {
  console.error('usage: check.mjs <base url> [--shot <png>]');
  process.exit(2);
}
const shotAt = process.argv.indexOf('--shot');
const shot = shotAt > 0 ? process.argv[shotAt + 1] : undefined;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  // A page error ends the run at once, with what went wrong, rather than a
  // wait for a board that will never finish.
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const started = Date.now();
  // Only the units on the loading contract: the ones not converted yet show
  // on /design/loading, but cannot fail a pull request.
  await page.goto(`${base}/design/loading?only=contract`);
  const done = page.waitForSelector('[data-proof="done"]', {
    timeout: 120_000,
  });
  const failed = new Promise((_, reject) => {
    const tick = setInterval(() => {
      if (errors.length > 0) {
        clearInterval(tick);
        reject(new Error(`the page failed:\n  ${errors.join('\n  ')}`));
      }
    }, 200);
    void done.finally(() => {
      clearInterval(tick);
    });
  });
  await Promise.race([done, failed]);
  const results = await page.evaluate(() => window.loadingProof);
  if (shot) await page.screenshot({ path: shot });

  // A run that measured nothing proves nothing.
  if (!Array.isArray(results) || results.length === 0)
    throw new Error('the board finished with no results');
  const off = results.filter((r) => r.contract && !r.ok);
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `Loading proof: ${String(results.length)} states on the contract, measured in ${secs}s; ${String(off.length)} off.`,
  );
  for (const r of off) console.log(`  ${r.unit}:${r.state}: ${r.note}`);
  if (off.length > 0) process.exitCode = 1;
} catch (e) {
  console.error(`Loading proof: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}

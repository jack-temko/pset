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
  const started = Date.now();
  // Only the units on the loading contract: the ones not converted yet show
  // on /design/loading, but cannot fail a pull request.
  await page.goto(`${base}/design/loading?only=contract`);
  await page.waitForSelector('[data-proof="done"]', { timeout: 10 * 60_000 });
  const results = await page.evaluate(() => window.loadingProof ?? []);
  if (shot) await page.screenshot({ path: shot });

  const off = results.filter((r) => r.contract && !r.ok);
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `Loading proof: ${String(results.length)} states on the contract, measured in ${secs}s; ${String(off.length)} off.`,
  );
  for (const r of off)
    console.log(`  ${r.unit}:${r.state}: loading is ${r.note}`);
  if (off.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}

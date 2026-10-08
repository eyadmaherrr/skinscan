/**
 * Developer tool: prints the internal quality diagnostics and raw metric
 * values for one or more photos (including photos the gate rejects).
 *
 *   npx tsx scripts/diagnose.ts <photo.jpg> [...]
 */
import { readFile } from 'node:fs/promises';
import { analyzeImageDetailed } from '../lib/skin-analysis';
import { ScanError } from '../lib/skin-analysis/errors';

const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));

async function main() {
  for (const file of process.argv.slice(2)) {
    try {
      const d = await analyzeImageDetailed(await readFile(file), { maxInputPixels: 40e6, maxSide: 2560, deadline: Date.now() + 60_000 });
      console.log(file, 'ACCEPTED');
      console.log('  quality', JSON.stringify(round(d.quality.diagnostics)));
      console.log('  raw    ', JSON.stringify(Object.fromEntries(d.measurements.map((m) => [m.key, m.raw === null ? null : Math.round(m.raw * 1000) / 1000]))));
      console.log('  scores ', JSON.stringify(Object.fromEntries(Object.entries(d.result.analysis).map(([k, v]) => [k, `${v.score ?? '—'} (${v.confidence})`]))));
    } catch (e) {
      if (!(e instanceof ScanError)) throw e;
      console.log(file, 'REJECTED', e.issues.map((i) => i.code).join(', ') || e.code);
      if (e.diagnostics) console.log('  quality', JSON.stringify(round(e.diagnostics)));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

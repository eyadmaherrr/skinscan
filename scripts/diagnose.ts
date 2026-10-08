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
      const { acne, pores, dermFoundation } = d.result;
      console.log('  acne   ', JSON.stringify({ status: acne?.status, candidates: acne?.lesionCandidateCount, red: acne?.redToneCount, dark: acne?.darkToneCount, severity: acne?.severity }));
      console.log('  pores  ', JSON.stringify({ status: pores?.status, score: pores?.visibilityScore, conf: pores?.confidence, raw: d.extensions.poresRaw, regions: pores?.regionalSummary, heatmapKB: pores?.heatmap ? Math.round(pores.heatmap.length / 1024) : 0 }));
      console.log('  derm   ', JSON.stringify(dermFoundation));
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

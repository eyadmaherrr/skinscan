/**
 * Times the full pipeline on one or more photos and prints the core scores.
 *
 *   npx tsx scripts/time-scan.ts photo.jpg [photo2.jpg …]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { analyzeImageDetailed } from '../lib/skin-analysis';
import { ScanError } from '../lib/skin-analysis/errors';
import { METRIC_KEYS } from '../lib/skin-analysis/types';

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error('usage: npx tsx scripts/time-scan.ts photo.jpg [...]');
  for (const file of files) {
    const buffer = await readFile(file);
    const start = Date.now();
    try {
      const { result } = await analyzeImageDetailed(buffer, { maxInputPixels: 40e6, maxSide: 2560, deadline: Date.now() + 120_000 });
      const ms = Date.now() - start;
      const scores = METRIC_KEYS.map((k) => {
        const m = result.analysis[k];
        return `${k}=${m.score ?? '—'}(${m.confidence})`;
      }).join(' ');
      console.log(`${path.basename(file)} ${ms} ms overall=${result.overallConfidence} ${scores}`);
    } catch (e) {
      const ms = Date.now() - start;
      console.log(`${path.basename(file)} ${ms} ms rejected: ${e instanceof ScanError ? `${e.code} ${e.issues.map((i) => i.code).join(',')}` : String(e)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

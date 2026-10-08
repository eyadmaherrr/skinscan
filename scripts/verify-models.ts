/**
 * Verifies that every model file matches the SHA-256 recorded in
 * models/manifest.json (the server performs the same check when loading).
 *
 *   npm run verify-models
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const dir = path.join(process.cwd(), 'models');
  const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
  let ok = true;
  for (const [key, entry] of Object.entries(manifest.models) as [string, { file: string; sha256: string; name: string }][]) {
    const digest = createHash('sha256').update(await readFile(path.join(dir, entry.file))).digest('hex');
    const match = digest === entry.sha256;
    ok &&= match;
    console.log(`${match ? 'ok      ' : 'MISMATCH'} ${key.padEnd(14)} ${entry.file} (${entry.name})`);
  }
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

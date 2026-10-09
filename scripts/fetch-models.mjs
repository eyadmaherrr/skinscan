/**
 * Downloads the models that are too large to keep in git (entries marked
 * "fetchedAtBuild" in models/manifest.json — currently the skin-age model)
 * from their pinned source URL, and keeps a file only if its SHA-256 matches
 * the manifest. Runs automatically before `npm run build` (prebuild); run it
 * once by hand for local development:
 *
 *   node scripts/fetch-models.mjs
 *
 * A missing model makes the build fail, so a deployment never goes out
 * without it by accident. To build without the skin-age estimate, set
 * SKINSCAN_SKIN_AGE=false.
 */
import { createHash } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dir = process.env.SKIN_SCAN_MODEL_DIR || path.join(process.cwd(), 'models');
const skinAgeOff = ['0', 'false', 'off', 'no'].includes((process.env.SKINSCAN_SKIN_AGE ?? '').trim().toLowerCase());

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function existingDigest(file) {
  try {
    return sha256(await readFile(file));
  } catch {
    return null;
  }
}

async function download(url, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(300_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      console.warn(`  attempt ${i} failed: ${error instanceof Error ? error.message : error}`);
      if (i < attempts) await new Promise((resolve) => setTimeout(resolve, 2000 * i));
    }
  }
  throw lastError;
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')).models;
  let failed = false;
  for (const [name, entry] of Object.entries(manifest)) {
    if (!entry.fetchedAtBuild) continue;
    if (name === 'skinAge' && skinAgeOff) {
      console.log(`${name}: skipped (SKINSCAN_SKIN_AGE=false)`);
      continue;
    }
    const file = path.join(dir, entry.file);
    if ((await existingDigest(file)) === entry.sha256) {
      console.log(`${name}: ${entry.file} present, checksum OK`);
      continue;
    }
    console.log(`${name}: downloading ${entry.source.url}`);
    try {
      const bytes = await download(entry.source.url);
      const digest = sha256(bytes);
      if (digest !== entry.sha256) throw new Error(`checksum mismatch (got ${digest})`);
      const tmp = `${file}.download`;
      await writeFile(tmp, bytes);
      await rename(tmp, file);
      console.log(`${name}: saved ${entry.file} (${(bytes.length / 1e6).toFixed(1)} MB), checksum OK`);
    } catch (error) {
      failed = true;
      await rm(`${file}.download`, { force: true });
      console.error(`${name}: could not fetch ${entry.file}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (failed) {
    console.error('Model download failed. Retry the build, or set SKINSCAN_SKIN_AGE=false to build without the skin-age estimate.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

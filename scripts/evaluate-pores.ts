/**
 * Pore-visibility evaluation across image resolutions (see docs/TESTING.md).
 *
 * The pore estimate needs far more detail than the core metrics, and the
 * reference photos are mostly analysed below its resolution gate. This
 * script takes every accepted reference photo that has enough native
 * resolution, downsizes it so the face is at a given scale (px/mm), and runs
 * the full pipeline with the pore resolution gate lifted, so stability can be
 * measured at each scale:
 *
 *   - harmless changes: mild sensor noise, JPEG re-encode (q80), mirror;
 *   - construct check: small darker dots (0.4 mm wide, 25% darker, 1.6 mm
 *     apart — visibly enlarged pores) painted on the nose and upper cheeks
 *     must raise the raw value;
 *   - a line check: thin darker lines (0.15 mm wide, wrinkle-like) painted on
 *     the cheeks should not raise it much.
 *
 *   npx tsx scripts/evaluate-pores.ts [--scales 5,5.5,6,6.5] [--roundness 0.3] [--bright 3.5]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { analyzeImageDetailed, type DetailedAnalysis } from '../lib/skin-analysis';
import { MEAN_IOD_MM } from '../lib/skin-analysis/alignment';
import { PORE_DETECTION, PORE_THRESHOLDS } from '../lib/skin-analysis/extensions/pores';
import { ScanError } from '../lib/skin-analysis/errors';
import { ITEMS } from './fetch-test-images';

interface Raw {
  data: Buffer;
  width: number;
  height: number;
}

const REF = path.join(process.cwd(), 'test-data', 'reference');
const OPTIONS = { maxInputPixels: 40e6, maxSide: 4096 };
/** Largest scale the aligned crop can have (IOD capped at 420 px). */
const MAX_SCALE = 420 / MEAN_IOD_MM;

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussianNoise(rand: () => number) {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const toLin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const toSrgb = (l: number) => {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(Math.max(0, l), 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};
const sharpRaw = (img: Raw) => sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } });
const jpeg = (img: Raw, quality = 92) => sharpRaw(img).jpeg({ quality }).toBuffer();

async function decode(buffer: Buffer): Promise<Raw> {
  const { data, info } = await sharp(buffer).rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function resize(img: Raw, factor: number): Promise<Raw> {
  if (factor >= 0.999) return img;
  const width = Math.round(img.width * factor);
  const { data, info } = await sharpRaw(img).resize(width, null, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function centroid(base: DetailedAnalysis, region: string, img: Raw): [number, number] {
  const outline = base.result.regions.find((r) => r.region === region)!.points;
  const cx = outline.reduce((s, p) => s + p[0], 0) / outline.length;
  const cy = outline.reduce((s, p) => s + p[1], 0) / outline.length;
  return [cx * img.width, cy * img.height];
}

/** Multiply linear RGB by (1 − depth·coverage(x, y)). */
function darken(img: Raw, coverage: (x: number, y: number) => number, depth: number): Raw {
  const out = Buffer.from(img.data);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const c = coverage(x, y);
      if (c <= 0) continue;
      const k = 1 - depth * Math.min(1, c);
      const i = (y * img.width + x) * 3;
      for (let ch = 0; ch < 3; ch++) out[i + ch] = toSrgb(toLin(img.data[i + ch]) * k);
    }
  }
  return { ...img, data: out };
}

/** Grid of soft dots (radius in px) on the nose and upper cheeks. */
function poreDots(img: Raw, base: DetailedAnalysis, mmPx: number): Raw {
  const step = 1.6 * mmPx;
  const radius = 0.2 * mmPx;
  const centres: [number, number][] = [];
  for (const region of ['nose', 'cheekL', 'cheekR']) {
    const [cx, cy] = centroid(base, region, img);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) centres.push([cx + dx * step, cy - 2 * step + dy * step]);
  }
  const reach = radius * 1.5;
  return darken(
    img,
    (x, y) => {
      let c = 0;
      for (const [cx, cy] of centres) {
        if (Math.abs(x - cx) > reach || Math.abs(y - cy) > reach) continue;
        c = Math.max(c, 1 - Math.hypot(x - cx, y - cy) / reach);
      }
      return c;
    },
    0.25,
  );
}

/** Thin slanted lines (0.15 mm half-width, 1.2 mm apart) on the cheeks: wrinkle-like structures. */
function fineLines(img: Raw, base: DetailedAnalysis, mmPx: number): Raw {
  const half = 0.15 * mmPx;
  const spacing = 1.2 * mmPx;
  const extent = 7 * mmPx;
  const centres = ['cheekL', 'cheekR'].map((r) => centroid(base, r, img));
  const [dx, dy] = [Math.cos(0.5), Math.sin(0.5)];
  return darken(
    img,
    (x, y) => {
      for (const [cx, cy] of centres) {
        const u = (x - cx) * dx + (y - cy) * dy;
        const v = -(x - cx) * dy + (y - cy) * dx;
        if (Math.abs(u) > extent || Math.abs(v) > extent * 0.6) continue;
        const d = Math.abs(v - spacing * Math.round(v / spacing));
        if (d < half * 1.5) return 1 - d / (half * 1.5);
      }
      return 0;
    },
    0.12,
  );
}

interface Run {
  status: string;
  score: number | null;
  raw: number | null;
}

async function analyse(buffer: Buffer): Promise<{ run: Run; detail?: DetailedAnalysis }> {
  try {
    const detail = await analyzeImageDetailed(buffer, { ...OPTIONS, deadline: Date.now() + 120_000 });
    const pores = detail.result.pores;
    return { run: { status: pores?.status ?? 'missing', score: pores?.visibilityScore ?? null, raw: detail.extensions.poresRaw }, detail };
  } catch (e) {
    if (e instanceof ScanError) return { run: { status: `rejected:${e.issues.map((i) => i.code).join('+') || e.code}`, score: null, raw: null } };
    throw e;
  }
}

async function main() {
  const arg = process.argv.indexOf('--scales');
  const scales = arg > 0 ? process.argv[arg + 1].split(',').map(Number) : [4.5, 5, 5.5, 6, 6.5];
  // Lift the resolution part of the pore gate (evaluation only); every other check stays.
  (PORE_THRESHOLDS as { minPxPerMm: number }).minPxPerMm = 0;
  const option = (name: string) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? Number(process.argv[i + 1]) : null;
  };
  const detection = PORE_DETECTION as { minRoundness: number; brightSpreadFactor: number };
  detection.minRoundness = option('--roundness') ?? detection.minRoundness;
  detection.brightSpreadFactor = option('--bright') ?? detection.brightSpreadFactor;
  console.log(`detector: roundness ≥ ${detection.minRoundness}, bright-spread factor ${detection.brightSpreadFactor}`);

  const accepted = ITEMS.filter((i) => i.expect === 'accept');
  type Row = { subject: string; scale: number; base: Run; noise: Run; q80: Run; mirror: Run; dots: Run; lines: Run };
  const rows: Row[] = [];
  let n = 0;
  for (const item of accepted) {
    const file = path.join(REF, `${item.id}.jpg`);
    let buffer: Buffer;
    try {
      buffer = await readFile(file);
    } catch {
      continue;
    }
    n++;
    const native = await decode(buffer);
    const first = await analyse(await jpeg(native));
    if (!first.detail) {
      console.log(`S${n}: native photo ${first.run.status}`);
      continue;
    }
    const nativeIod = first.detail.face.sourceIod;
    const nativeScale = Math.min(MAX_SCALE, nativeIod / MEAN_IOD_MM);
    for (const scale of scales) {
      if (scale > nativeScale + 0.05) continue;
      const factor = Math.min(1, (scale * MEAN_IOD_MM) / nativeIod);
      const img = await resize(native, factor);
      const mmPx = (nativeIod * factor) / MEAN_IOD_MM;
      const base = await analyse(await jpeg(img));
      if (!base.detail) {
        console.log(`S${n} @${scale}: ${base.run.status}`);
        continue;
      }
      const rand = prng(1);
      const noisy = Buffer.alloc(img.data.length);
      for (let i = 0; i < noisy.length; i++) noisy[i] = Math.max(0, Math.min(255, Math.round(img.data[i] + 4 * gaussianNoise(rand))));
      const nativeDots = await resize(poreDots(native, first.detail, nativeIod / MEAN_IOD_MM), factor);
      const nativeLines = await resize(fineLines(native, first.detail, nativeIod / MEAN_IOD_MM), factor);
      const row: Row = {
        subject: `S${n}`,
        scale: Math.round(Math.min(MAX_SCALE, mmPx) * 100) / 100,
        base: base.run,
        noise: (await analyse(await jpeg({ ...img, data: noisy }))).run,
        q80: (await analyse(await jpeg(img, 80))).run,
        mirror: (await analyse(await sharpRaw(img).flop().jpeg({ quality: 92 }).toBuffer())).run,
        dots: (await analyse(await jpeg(nativeDots))).run,
        lines: (await analyse(await jpeg(nativeLines))).run,
      };
      rows.push(row);
      const f = (r: Run) => (r.score === null ? `${r.status}` : `${r.score} (${r.raw?.toFixed(1)})`);
      console.log(`${row.subject} @${row.scale}: base ${f(row.base)} | noise ${f(row.noise)} | q80 ${f(row.q80)} | mirror ${f(row.mirror)} | dots ${f(row.dots)} | lines ${f(row.lines)}`);
    }
  }

  console.log('\n| Scale (px/mm) | n | base score (mean) | noise Δ mean / max | q80 Δ | mirror Δ | dots: raw ↑ in | dots raw Δ (mean) | lines raw Δ (mean) |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const scale of scales) {
    const rs = rows.filter((r) => Math.abs(r.scale - scale) < 0.06 && r.base.score !== null);
    if (!rs.length) continue;
    const delta = (k: 'noise' | 'q80' | 'mirror') => {
      const d = rs.filter((r) => r[k].score !== null).map((r) => Math.abs((r[k].score as number) - (r.base.score as number)));
      return d.length ? `${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1)} / ${Math.max(...d)}` : 'n/a';
    };
    const rawDelta = (k: 'dots' | 'lines') => {
      const d = rs.filter((r) => r[k].raw !== null).map((r) => (r[k].raw as number) - (r.base.raw as number));
      return d.length ? (d.reduce((a, b) => a + b, 0) / d.length).toFixed(1) : 'n/a';
    };
    const up = rs.filter((r) => r.dots.raw !== null && (r.dots.raw as number) > (r.base.raw as number)).length;
    const mean = rs.reduce((s, r) => s + (r.base.score as number), 0) / rs.length;
    console.log(`| ${scale} | ${rs.length} | ${mean.toFixed(1)} | ${delta('noise')} | ${delta('q80')} | ${delta('mirror')} | ${up}/${rs.length} | ${rawDelta('dots')} | ${rawDelta('lines')} |`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

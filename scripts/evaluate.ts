/**
 * Evaluation harness (see docs/TESTING.md).
 *
 * For every reference photo in test-data/reference it runs the full pipeline
 * on the original and on synthetic variants that simulate common capture
 * problems, then reports:
 *   1. quality-gate decisions vs. the expected outcome per variant,
 *   2. results sliced by skin-tone group (ITA°, Del Bino et al. categories),
 *   3. stability: score changes under harmless changes (mirror, rescale, re-encode, noise),
 *   4. construct checks: adding red spots / a brown patch must raise the right metrics,
 *   5. determinism: the same input twice gives identical output,
 *   6. timing.
 *
 * Synthetic sensor noise uses a fixed-seed generator, so runs are reproducible.
 *
 *   npx tsx scripts/evaluate.ts [--only id1,id2]
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { analyzeImageDetailed, type DetailedAnalysis } from '../lib/skin-analysis';
import { ScanError } from '../lib/skin-analysis/errors';
import { METRIC_KEYS, type MetricKey, type QualityIssueCode } from '../lib/skin-analysis/types';

interface Raw {
  data: Buffer;
  width: number;
  height: number;
}

interface Outcome {
  accepted: boolean;
  issues: QualityIssueCode[];
  error?: string;
  scores?: Record<MetricKey, number | null>;
  confidences?: Record<MetricKey, number>;
  raw?: Record<MetricKey, number | null>;
  overall?: number;
  diagnostics?: Record<string, number>;
  /** Extension components. */
  pores?: { status: string; score: number | null; raw: number | null };
  acne?: { candidates: number | null; red: number | null; severity: string | null; pSevere: number | null };
  ms: number;
}

type Expect = 'accept' | QualityIssueCode[];

interface Variant {
  id: string;
  expect: Expect;
  make: (img: Raw, base: DetailedAnalysis) => Promise<Buffer>;
}

const REF = path.join(process.cwd(), 'test-data', 'reference');
const OUT = path.join(process.cwd(), 'test-data', 'eval');
const OPTIONS = { maxInputPixels: 40e6, maxSide: 2560 };

// ---------------------------------------------------------------- utilities
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
function jpeg(img: Raw, quality = 92) {
  return sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } }).jpeg({ quality }).toBuffer();
}
function mapLinear(img: Raw, f: (x: number, y: number, rgb: [number, number, number]) => [number, number, number]): Raw {
  const out = Buffer.alloc(img.data.length);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 3;
      const [r, g, b] = f(x, y, [toLin(img.data[i]), toLin(img.data[i + 1]), toLin(img.data[i + 2])]);
      out[i] = toSrgb(r);
      out[i + 1] = toSrgb(g);
      out[i + 2] = toSrgb(b);
    }
  }
  return { ...img, data: out };
}
function centroid(base: DetailedAnalysis, region: string, img: Raw): [number, number] {
  const outline = base.result.regions.find((r) => r.region === region)!.points;
  const cx = outline.reduce((s, p) => s + p[0], 0) / outline.length;
  const cy = outline.reduce((s, p) => s + p[1], 0) / outline.length;
  return [cx * img.width, cy * img.height];
}
/** Multiply linear RGB by `factor` inside soft disks. */
function paintDisks(img: Raw, disks: [number, number][], radius: number, factor: [number, number, number]): Raw {
  return mapLinear(img, (x, y, [r, g, b]) => {
    let wgt = 0;
    for (const [cx, cy] of disks) {
      const d = Math.hypot(x - cx, y - cy) / radius;
      wgt = Math.max(wgt, d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d));
    }
    if (!wgt) return [r, g, b];
    return [r * (1 - wgt + wgt * factor[0]), g * (1 - wgt + wgt * factor[1]), b * (1 - wgt + wgt * factor[2])];
  });
}

// ----------------------------------------------------------------- variants
const VARIANTS: Variant[] = [
  { id: 'mirror', expect: 'accept', make: (img) => sharp(img.data, { raw: { ...img, channels: 3 } }).flop().jpeg({ quality: 92 }).toBuffer() },
  { id: 'rescale_85', expect: 'accept', make: (img) => sharp(img.data, { raw: { ...img, channels: 3 } }).resize(Math.round(img.width * 0.85)).jpeg({ quality: 92 }).toBuffer() },
  { id: 'reencode_q80', expect: 'accept', make: (img) => jpeg(img, 80) },
  {
    id: 'noise_mild',
    expect: 'accept',
    make: (img) => {
      const rand = prng(1);
      const out = Buffer.alloc(img.data.length);
      for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(img.data[i] + 4 * gaussianNoise(rand))));
      return jpeg({ ...img, data: out });
    },
  },
  { id: 'jpeg_q30', expect: 'accept', make: (img) => jpeg(img, 30) },
  { id: 'blur_mild', expect: 'accept', make: (img, b) => sharp(img.data, { raw: { ...img, channels: 3 } }).blur(Math.max(0.5, 0.006 * b.face.sourceIod)).jpeg({ quality: 92 }).toBuffer() },
  { id: 'blur_strong', expect: ['blurry'], make: (img, b) => sharp(img.data, { raw: { ...img, channels: 3 } }).blur(0.035 * b.face.sourceIod).jpeg({ quality: 92 }).toBuffer() },
  { id: 'dark_mild', expect: 'accept', make: (img) => jpeg(mapLinear(img, (_x, _y, [r, g, b]) => [r * 0.4, g * 0.4, b * 0.4])) },
  {
    id: 'dark_severe',
    expect: ['too_dark'],
    make: (img) => {
      const rand = prng(2);
      return jpeg(
        mapLinear(img, (_x, _y, [r, g, b]) => {
          const n = () => 0.0015 * gaussianNoise(rand);
          return [r * 0.04 + n(), g * 0.04 + n(), b * 0.04 + n()];
        }),
      );
    },
  },
  { id: 'overexposed', expect: ['too_bright'], make: (img) => jpeg(mapLinear(img, (_x, _y, [r, g, b]) => [r * 4, g * 4, b * 4])) },
  {
    id: 'side_light',
    expect: ['uneven_lighting'],
    make: (img, base) => {
      // Darken towards whichever cheek is already darker, as a strong side light would.
      const l = centroid(base, 'cheekL', img);
      const r = centroid(base, 'cheekR', img);
      const lum = ([x, y]: [number, number]) => {
        const i = (Math.round(y) * img.width + Math.round(x)) * 3;
        return img.data[i] + img.data[i + 1] + img.data[i + 2];
      };
      const [dark, bright] = lum(l) <= lum(r) ? [l[0], r[0]] : [r[0], l[0]];
      return jpeg(
        mapLinear(img, (x, _y, [rr, g, b]) => {
          const t = Math.max(0, Math.min(1, (x - dark) / (bright - dark)));
          const k = 0.15 + 0.85 * t;
          return [rr * k, g * k, b * k];
        }),
      );
    },
  },
  {
    id: 'beauty_filter',
    expect: ['filter_detected'],
    make: async (img, base) => {
      const sigma = Math.max(2, 0.03 * base.face.sourceIod);
      const smooth = await sharp(img.data, { raw: { ...img, channels: 3 } }).blur(sigma).raw().toBuffer();
      const grey = await sharp(img.data, { raw: { ...img, channels: 3 } }).greyscale().blur(1).raw().toBuffer();
      const out = Buffer.alloc(img.data.length);
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const i = y * img.width + x;
          const gx = x > 0 && x < img.width - 1 ? grey[i + 1] - grey[i - 1] : 0;
          const gy = y > 0 && y < img.height - 1 ? grey[i + img.width] - grey[i - img.width] : 0;
          const e = Math.min(1, Math.hypot(gx, gy) / 40); // keep strong edges (eyes, lips), smooth the rest
          for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(img.data[i * 3 + c] * e + smooth[i * 3 + c] * (1 - e));
        }
      }
      return jpeg({ ...img, data: out });
    },
  },
  { id: 'greyscale', expect: ['not_color'], make: (img) => sharp(img.data, { raw: { ...img, channels: 3 } }).greyscale().jpeg({ quality: 92 }).toBuffer() },
  { id: 'tiny_face', expect: ['face_too_small', 'no_face'], make: (img, b) => sharp(img.data, { raw: { ...img, channels: 3 } }).resize(Math.round((img.width * 50) / b.face.sourceIod)).jpeg({ quality: 92 }).toBuffer() },
  { id: 'low_resolution', expect: 'accept', make: (img, b) => sharp(img.data, { raw: { ...img, channels: 3 } }).resize(Math.round((img.width * 110) / b.face.sourceIod)).jpeg({ quality: 92 }).toBuffer() },
  { id: 'rotated_15', expect: 'accept', make: (img) => sharp(img.data, { raw: { ...img, channels: 3 } }).rotate(15, { background: '#808080' }).jpeg({ quality: 92 }).toBuffer() },
  {
    id: 'half_face',
    expect: ['face_cropped', 'no_face', 'face_angle'],
    make: (img, base) => {
      const [x] = centroid(base, 'nose', img);
      return sharp(img.data, { raw: { ...img, channels: 3 } }).extract({ left: Math.round(x), top: 0, width: img.width - Math.round(x), height: img.height }).jpeg({ quality: 92 }).toBuffer();
    },
  },
  {
    id: 'two_faces',
    expect: ['multiple_faces'],
    make: (img) =>
      sharp({ create: { width: img.width * 2, height: img.height, channels: 3, background: '#808080' } })
        .composite([
          { input: img.data, raw: { ...img, channels: 3 }, left: 0, top: 0 },
          { input: img.data, raw: { ...img, channels: 3 }, left: img.width, top: 0 },
        ])
        .jpeg({ quality: 92 })
        .toBuffer(),
  },
  {
    id: 'red_spots',
    expect: 'accept',
    make: (img, base) => {
      const mmPx = base.face.sourceIod / 63;
      const [lx, ly] = centroid(base, 'cheekL', img);
      const [rx, ry] = centroid(base, 'cheekR', img);
      const d = 6 * mmPx;
      const spots: [number, number][] = [
        [lx - d, ly - d], [lx + d, ly], [lx, ly + d],
        [rx + d, ry - d], [rx - d, ry], [rx, ry + d],
      ];
      return jpeg(paintDisks(img, spots, 1.6 * mmPx, [0.95, 0.62, 0.66]));
    },
  },
  {
    id: 'pore_dots',
    expect: 'accept',
    make: (img, base) => {
      // A regular pattern of tiny (0.15 mm radius), 10% darker dots on the nose and upper cheeks.
      const mmPx = base.face.sourceIod / 63;
      const step = Math.max(2, Math.round(1.6 * mmPx));
      const radius = Math.max(0.6, 0.15 * mmPx);
      const centres: [number, number][] = [];
      for (const region of ['nose', 'cheekL', 'cheekR']) {
        const [cx, cy] = centroid(base, region, img);
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) centres.push([cx + dx * step, cy - 2 * step + dy * step]);
      }
      return jpeg(
        mapLinear(img, (x, y, [r, g, b]) => {
          let k = 1;
          for (const [cx, cy] of centres) {
            const d = Math.hypot(x - cx, y - cy);
            if (d < radius * 1.5) k = Math.min(k, 1 - 0.1 * Math.max(0, 1 - d / (radius * 1.5)));
          }
          return [r * k, g * k, b * k];
        }),
        95,
      );
    },
  },
  {
    id: 'acne_like',
    expect: 'accept',
    make: (img, base) => {
      // Twenty raised-red 2–3 mm spots spread over both cheeks and the chin.
      const mmPx = base.face.sourceIod / 63;
      const spots: [number, number][] = [];
      const offsets = [[-8, -6], [-3, -9], [4, -5], [9, -1], [-6, 2], [0, 4], [6, 7]];
      for (const region of ['cheekL', 'cheekR', 'chin']) {
        const [cx, cy] = centroid(base, region, img);
        for (const [ox, oy] of offsets.slice(0, region === 'chin' ? 6 : 7)) spots.push([cx + ox * mmPx, cy + oy * mmPx * 0.8]);
      }
      return jpeg(paintDisks(img, spots, 1.3 * mmPx, [0.97, 0.6, 0.62]));
    },
  },
  {
    id: 'brown_patch',
    expect: 'accept',
    make: (img, base) => {
      const mmPx = base.face.sourceIod / 63;
      const [x, y] = centroid(base, 'cheekR', img);
      const [fx, fy] = centroid(base, 'forehead', img);
      return jpeg(paintDisks(img, [[x, y], [fx, fy]], 5 * mmPx, [0.72, 0.68, 0.6]));
    },
  },
  {
    id: 'red_area',
    expect: 'accept',
    make: (img, base) => {
      const mmPx = base.face.sourceIod / 63;
      return jpeg(paintDisks(img, [centroid(base, 'cheekL', img), centroid(base, 'cheekR', img)], 11 * mmPx, [1.0, 0.82, 0.86]));
    },
  },
];

// --------------------------------------------------------------- execution
async function run(buffer: Buffer): Promise<{ outcome: Outcome; detail?: DetailedAnalysis }> {
  const started = Date.now();
  try {
    const detail = await analyzeImageDetailed(buffer, { ...OPTIONS, deadline: Date.now() + 60_000 });
    const scores = {} as Record<MetricKey, number | null>;
    const confidences = {} as Record<MetricKey, number>;
    const raw = {} as Record<MetricKey, number | null>;
    for (const k of METRIC_KEYS) {
      scores[k] = detail.result.analysis[k].score;
      confidences[k] = detail.result.analysis[k].confidence;
    }
    for (const m of detail.measurements) raw[m.key] = m.raw === null ? null : Math.round(m.raw * 1000) / 1000;
    const sev = detail.result.acne?.severity;
    const probs = sev?.probabilities;
    return {
      detail,
      outcome: {
        accepted: true,
        issues: [],
        scores,
        confidences,
        raw,
        overall: detail.result.overallConfidence,
        diagnostics: detail.quality.diagnostics,
        pores: { status: detail.result.pores?.status ?? 'missing', score: detail.result.pores?.visibilityScore ?? null, raw: detail.extensions.poresRaw },
        acne: {
          candidates: detail.result.acne?.lesionCandidateCount ?? null,
          red: detail.result.acne?.redToneCount ?? null,
          severity: sev?.label ?? null,
          pSevere: probs ? (probs.level1 ?? 0) + (probs.level2 ?? 0) + (probs.level3 ?? 0) : null,
        },
        ms: Date.now() - started,
      },
    };
  } catch (e) {
    if (e instanceof ScanError) {
      return { outcome: { accepted: false, issues: e.issues.map((i) => i.code), error: e.code, diagnostics: e.diagnostics, ms: Date.now() - started } };
    }
    return { outcome: { accepted: false, issues: [], error: e instanceof Error ? e.message : String(e), ms: Date.now() - started } };
  }
}

function itaGroup(ita: number): string {
  if (ita > 55) return 'very light (ITA > 55°)';
  if (ita > 41) return 'light (41–55°)';
  if (ita > 28) return 'intermediate (28–41°)';
  if (ita > 10) return 'tan (10–28°)';
  if (ita > -30) return 'brown (−30–10°)';
  return 'dark (< −30°)';
}

function matches(expect: Expect, o: Outcome): boolean {
  if (expect === 'accept') return o.accepted;
  return !o.accepted && o.issues.some((i) => expect.includes(i));
}

async function main() {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
  await mkdir(OUT, { recursive: true });
  const files = (await readdir(REF)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && (!only || only.includes(path.parse(f).name)));
  const credits = JSON.parse(await readFile(path.join(REF, 'CREDITS.json'), 'utf8').catch(() => '{}'));
  const report: Record<string, { expect: string; note: string; original: Outcome; variants: Record<string, Outcome & { expect: Expect; ok: boolean }> }> = {};
  let subject = 0;

  for (const file of files) {
    const id = path.parse(file).name;
    const buffer = await readFile(path.join(REF, file));
    const expectOriginal = credits[id]?.expect ?? 'accept';
    const { outcome, detail } = await run(buffer);
    const second = await run(buffer);
    const deterministic = JSON.stringify({ ...outcome, ms: 0 }) === JSON.stringify({ ...second.outcome, ms: 0 });
    const label = `S${++subject}`;
    console.log(`${label} (${id}) original: ${outcome.accepted ? 'accepted' : `rejected ${outcome.issues.join(',') || outcome.error}`} deterministic=${deterministic}`);
    report[label] = { expect: expectOriginal, note: credits[id]?.note ?? '', original: { ...outcome, deterministic } as Outcome, variants: {} };
    if (!detail) continue;

    const img = await sharp(buffer).rotate().resize({ width: OPTIONS.maxSide, height: OPTIONS.maxSide, fit: 'inside', withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const rawImg: Raw = { data: img.data, width: img.info.width, height: img.info.height };
    for (const v of VARIANTS) {
      const variantBuffer = await v.make(rawImg, detail);
      const { outcome: vo } = await run(variantBuffer);
      const ok = matches(v.expect, vo);
      report[label].variants[v.id] = { ...vo, expect: v.expect, ok };
      console.log(`   ${ok ? 'ok  ' : 'MISS'} ${v.id.padEnd(15)} ${vo.accepted ? 'accepted' : `rejected ${vo.issues.join(',') || vo.error}`}`);
    }
  }
  await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n' + summarize(report));
}

function summarize(report: Record<string, { expect: string; note: string; original: Outcome; variants: Record<string, Outcome & { expect: Expect; ok: boolean }> }>): string {
  const lines: string[] = [];
  const subjects = Object.entries(report);
  // Gate decisions
  lines.push('## Quality gate decisions', '', '| Condition | Expected | Matched |', '|---|---|---|');
  const originals = subjects.filter(([, r]) => r.expect === 'accept');
  lines.push(`| original (frontal reference photos) | accept | ${originals.filter(([, r]) => r.original.accepted).length}/${originals.length} |`);
  for (const [label, r] of subjects.filter(([, r]) => r.expect === 'reject')) {
    lines.push(`| ${label} original: ${r.note} | reject | ${r.original.accepted ? 'no (accepted)' : `yes (${r.original.issues.join(', ')})`} |`);
  }
  for (const v of VARIANTS) {
    const rows = subjects.map(([, r]) => r.variants[v.id]).filter(Boolean);
    if (!rows.length) continue;
    lines.push(`| ${v.id} | ${v.expect === 'accept' ? 'accept' : `reject: ${v.expect.join(' / ')}`} | ${rows.filter((o) => o.ok).length}/${rows.length} |`);
  }
  // Skin tone slices
  lines.push('', '## Results by skin-tone group (accepted originals)', '', '| Subject | ITA° group | Overall confidence | ' + METRIC_KEYS.join(' | ') + ' |', '|---|---|---|' + METRIC_KEYS.map(() => '---').join('|') + '|');
  for (const [label, r] of subjects) {
    const o = r.original;
    if (!o.accepted || !o.diagnostics) continue;
    const cells = METRIC_KEYS.map((k) => (o.scores![k] === null ? `— (${o.confidences![k].toFixed(2)})` : `${o.scores![k]} (${o.confidences![k].toFixed(2)})`));
    lines.push(`| ${label} | ${itaGroup(o.diagnostics.skinITA)} | ${o.overall} | ${cells.join(' | ')} |`);
  }
  // Stability
  lines.push('', '## Stability (mean / max absolute score change vs. original)', '', '| Change | ' + METRIC_KEYS.join(' | ') + ' |', '|---|' + METRIC_KEYS.map(() => '---').join('|') + '|');
  for (const vid of ['mirror', 'rescale_85', 'reencode_q80', 'noise_mild', 'jpeg_q30', 'blur_mild', 'dark_mild', 'rotated_15', 'low_resolution']) {
    const cells = METRIC_KEYS.map((k) => {
      const deltas: number[] = [];
      for (const [, r] of subjects) {
        const v = r.variants[vid];
        const a = r.original.scores?.[k];
        const b = v?.scores?.[k];
        if (a != null && b != null) deltas.push(Math.abs(a - b));
      }
      if (!deltas.length) return 'n/a';
      return `${(deltas.reduce((s, d) => s + d, 0) / deltas.length).toFixed(1)} / ${Math.max(...deltas)}`;
    });
    lines.push(`| ${vid} | ${cells.join(' | ')} |`);
  }
  // Construct checks
  lines.push('', '## Construct checks (score change after synthetic edits)', '', '| Edit | Metric | Mean change | Increased in |', '|---|---|---|---|');
  for (const [vid, keys] of [['red_spots', ['blemishes']], ['red_area', ['redness']], ['brown_patch', ['pigmentation']]] as [string, MetricKey[]][]) {
    for (const k of keys) {
      const deltas: number[] = [];
      for (const [, r] of subjects) {
        const a = r.original.scores?.[k];
        const b = r.variants[vid]?.scores?.[k];
        if (a != null && b != null) deltas.push(b - a);
      }
      if (deltas.length) lines.push(`| ${vid} | ${k} | ${(deltas.reduce((s, d) => s + d, 0) / deltas.length).toFixed(1)} | ${deltas.filter((d) => d > 0).length}/${deltas.length} |`);
    }
  }
  // Extensions
  lines.push('', '## Extension components', '');
  lines.push('| Subject | Pores (status / score / raw) | Spot candidates (red) | Acne classifier (label, P(level≥1)) |', '|---|---|---|---|');
  for (const [label, r] of subjects) {
    const o = r.original;
    if (!o.accepted) continue;
    const pores = o.pores ? `${o.pores.status} / ${o.pores.score ?? '—'} / ${o.pores.raw?.toFixed(1) ?? '—'}` : 'n/a';
    const acne = o.acne ? `${o.acne.candidates} (${o.acne.red})` : 'n/a';
    const sev = o.acne?.severity ? `${o.acne.severity}, ${o.acne.pSevere?.toFixed(2)}` : 'disabled';
    lines.push(`| ${label} | ${pores} | ${acne} | ${sev} |`);
  }
  const extStability = (field: (o: Outcome) => number | null | undefined, name: string) => {
    const row: string[] = [];
    for (const vid of ['mirror', 'rescale_85', 'reencode_q80', 'noise_mild', 'jpeg_q30', 'rotated_15', 'dark_mild']) {
      const deltas: number[] = [];
      for (const [, r] of subjects) {
        const a = field(r.original);
        const b = r.variants[vid] ? field(r.variants[vid]) : null;
        if (a != null && b != null) deltas.push(Math.abs(a - b));
      }
      row.push(deltas.length ? `${(deltas.reduce((s, d) => s + d, 0) / deltas.length).toFixed(1)} / ${Math.max(...deltas).toFixed(1)} (n=${deltas.length})` : 'n/a');
    }
    lines.push(`| ${name} | ${row.join(' | ')} |`);
  };
  lines.push('', '| Stability (mean / max abs. change) | mirror | rescale_85 | reencode_q80 | noise_mild | jpeg_q30 | rotated_15 | dark_mild |', '|---|---|---|---|---|---|---|---|');
  extStability((o) => o.pores?.score, 'pore score');
  extStability((o) => o.acne?.candidates, 'spot candidates');
  extStability((o) => (o.acne?.pSevere == null ? null : o.acne.pSevere * 100), 'acne classifier P(level≥1) ×100');
  const construct = (vid: string, field: (o: Outcome) => number | null | undefined, name: string) => {
    const deltas: number[] = [];
    for (const [, r] of subjects) {
      const a = field(r.original);
      const b = r.variants[vid] ? field(r.variants[vid]) : null;
      if (a != null && b != null) deltas.push(b - a);
    }
    if (deltas.length) lines.push(`| ${vid} | ${name} | ${(deltas.reduce((s, d) => s + d, 0) / deltas.length).toFixed(2)} | ${deltas.filter((d) => d > 0).length}/${deltas.length} |`);
    else lines.push(`| ${vid} | ${name} | not measurable | 0/0 |`);
  };
  lines.push('', '| Edit | Measure | Mean change | Increased in |', '|---|---|---|---|');
  construct('pore_dots', (o) => o.pores?.raw, 'pore raw (weighted pores/cm²)');
  construct('acne_like', (o) => o.acne?.candidates, 'spot candidates');
  construct('acne_like', (o) => o.acne?.red, 'red-toned candidates');
  construct('acne_like', (o) => o.acne?.pSevere, 'acne classifier P(level≥1)');

  const times = subjects.map(([, r]) => r.original.ms).filter((ms) => ms > 0);
  lines.push('', `Median analysis time: ${times.sort((a, b) => a - b)[Math.floor(times.length / 2)] ?? 'n/a'} ms`);
  return lines.join('\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

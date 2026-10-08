/**
 * Downloads the evaluation photos into test-data/reference (git-ignored).
 *
 * Only images whose Wikimedia Commons licence is public domain or CC0/CC BY
 * are accepted (mostly official portraits by US government agencies, which
 * are public-domain works). Attribution is written next to the files.
 * Photos of real people are never committed to the repository.
 *
 *   npx tsx scripts/fetch-test-images.ts
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

interface Item {
  id: string;
  title: string;
  /** Expected scenario, used by the evaluation script. */
  expect: 'accept' | 'reject';
  note: string;
  width?: number;
}

export const ITEMS: Item[] = [
  { id: 'watkins', title: 'File:Jessica Watkins Official NASA Portrait in 2021 (cropped).jpg', expect: 'reject', note: 'head turned ~31°' },
  { id: 'glover', title: 'File:Victor Glover official portrait 2020 (cropped).jpg', expect: 'reject', note: 'heavily sharpened / clarity-edited portrait' },
  { id: 'kim', title: 'File:Jonny Kim official portrait (cropped).jpg', expect: 'accept', note: 'frontal studio portrait' },
  { id: 'chari', title: 'File:Raja Chari, official portrait, 2017 (cropped).jpg', expect: 'accept', note: 'frontal studio portrait' },
  { id: 'moghbeli', title: 'File:Jasmin Moghbeli official portrait (cropped).jpg', expect: 'accept', note: 'frontal studio portrait' },
  { id: 'ohara', title: "File:Loral O'Hara portrait (cropped).jpg", expect: 'accept', note: 'frontal studio portrait' },
  { id: 'wilson', title: 'File:Stephanie Wilson in 2008.jpg', expect: 'reject', note: 'strong one-sided lighting, head turned ~17°' },
  { id: 'epps', title: 'File:Jeanette J. Epps (cropped).jpg', expect: 'accept', note: 'frontal portrait' },
  { id: 'barron', title: 'File:Kayla Barron official portrait.jpg', expect: 'accept', note: 'frontal studio portrait' },
  { id: 'menon', title: 'File:Anil Menon astronaut.jpg', expect: 'accept', note: 'frontal portrait' },
  { id: 'cardman', title: 'File:Zena Cardman official portrait (cropped).jpg', expect: 'accept', note: 'frontal studio portrait' },
  { id: 'douglas', title: 'File:Artemis III mission specialist Andre Douglas poses for an official portrait (jsc2026e391946 alt).jpg', expect: 'reject', note: 'head turned ~51°' },
  { id: 'williams', title: 'File:Sunita Williams in 2018 (cropped).jpg', expect: 'reject', note: 'heavily edited portrait, clipped highlights' },
  { id: 'ochoa', title: 'File:Ellen Ochoa, official portrait (cropped).jpg', expect: 'accept', note: 'frontal studio portrait' },
  { id: 'wright', title: 'File:Ron Wright, official portrait, 116th Congress (headshot).jpg', expect: 'reject', note: 'wearing glasses, bright flash' },
  { id: 'rose', title: 'File:John Rose, official portrait, 116th Congress (3x4).jpg', expect: 'reject', note: 'wearing glasses' },
  { id: 'sunglasses', title: 'File:Close portrait of a young woman wearing black sunglasses in Maracaibo, Venezuela.jpg', expect: 'reject', note: 'sunglasses, head turned' },
  { id: 'crew', title: 'File:STS-131 Official Crew Photo.jpg', expect: 'reject', note: 'multiple faces' },
  { id: 'earth', title: 'File:The Blue Marble.jpg', expect: 'reject', note: 'no face', width: 1200 },
];

const OUT = path.join(process.cwd(), 'test-data', 'reference');
const UA = 'drmaher-skinscan-evaluation/1.0 (https://skinscan.drmahermahmoud.com)';
const ALLOWED = /^(public domain|pd|cc0|cc by(-sa)? [0-9.]+|cc by [0-9.]+)/i;

async function fetchWithRetry(url: URL | string, attempts = 4): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120_000) });
      if (res.ok || res.status === 404) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  throw last;
}

async function exists(p: string) {
  return access(p).then(
    () => true,
    () => false,
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const credits: Record<string, unknown> = {};
  for (const item of ITEMS) {
    try {
      await fetchOne(item, credits);
    } catch (e) {
      console.warn(`skip ${item.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  await writeFile(path.join(OUT, 'CREDITS.json'), JSON.stringify(credits, null, 2));
}

async function fetchOne(item: Item, credits: Record<string, unknown>) {
  {
    const file = path.join(OUT, `${item.id}.jpg`);
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query',
      titles: item.title,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|size',
      iiurlwidth: String(item.width ?? 1600),
      format: 'json',
    }).toString();
    const meta = await (await fetchWithRetry(url)).json();
    const page = Object.values(meta.query.pages)[0] as { imageinfo?: { thumburl: string; extmetadata: Record<string, { value: string }> }[] };
    const info = page.imageinfo?.[0];
    if (!info) {
      console.warn(`skip ${item.id}: not found`);
      return;
    }
    const license = info.extmetadata.LicenseShortName?.value ?? '';
    if (!ALLOWED.test(license)) {
      console.warn(`skip ${item.id}: licence "${license}" not allowed`);
      return;
    }
    credits[item.id] = {
      title: item.title,
      license,
      artist: info.extmetadata.Artist?.value?.replace(/<[^>]+>/g, '') ?? '',
      source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
      expect: item.expect,
      note: item.note,
    };
    if (await exists(file)) return;
    const img = await fetchWithRetry(info.thumburl);
    if (!img.ok) {
      console.warn(`skip ${item.id}: HTTP ${img.status}`);
      return;
    }
    await writeFile(file, Buffer.from(await img.arrayBuffer()));
    console.log(`saved ${item.id} (${license})`);
  }
}

if (process.argv[1]?.endsWith('fetch-test-images.ts')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

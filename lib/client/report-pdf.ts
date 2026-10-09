/**
 * Minimal PDF writer for the downloadable report: one full-page JPEG per
 * page (rendered on a canvas, so Arabic and right-to-left text look exactly
 * as in the browser) plus clickable links. No dependencies; runs in the
 * browser and in Node (tests).
 */

export interface PdfLink {
  url: string;
  /** Position on the page image in pixels, top-left origin. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPage {
  /** JPEG bytes of the whole page. */
  jpeg: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  links?: PdfLink[];
}

/** A4 in PDF points. */
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const encoder = new TextEncoder();

/** Text string as UTF-16BE hex with a byte-order mark (any language). */
function textString(value: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < value.length; i++) hex += value.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

/** ASCII literal string (URLs). */
function asciiString(value: string): string {
  const safe = Array.from(value, (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126 ? encodeURIComponent(c) : c)).join('');
  return `(${safe.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

const num = (v: number) => (Math.round(v * 100) / 100).toString();

export function buildPdf(pages: PdfPage[], title: string): Uint8Array {
  if (!pages.length) throw new Error('A PDF needs at least one page');

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };

  // Object numbers: 1 catalog, 2 page tree, 3 info, then per page: page, contents, image, links.
  let next = 4;
  const layout = pages.map((page) => {
    const ids = { page: next++, contents: next++, image: next++, links: (page.links ?? []).map(() => next++) };
    return { page, ids };
  });
  const objectCount = next;

  const object = (id: number, body: string | Uint8Array[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body.forEach(push);
    push('\nendobj\n');
  };

  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // "%âãÏÓ": marks the file as binary
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${layout.map((l) => `${l.ids.page} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  object(3, `<< /Title ${textString(title)} /Producer (SkinScan by Dr Maher) >>`);

  for (const { page, ids } of layout) {
    const scale = PAGE_WIDTH / page.pixelWidth;
    const height = Math.min(PAGE_HEIGHT, page.pixelHeight * scale);
    const annots = ids.links.length ? ` /Annots [${ids.links.map((id) => `${id} 0 R`).join(' ')}]` : '';
    object(
      ids.page,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PAGE_WIDTH)} ${num(height)}] /Resources << /XObject << /Im0 ${ids.image} 0 R >> >> /Contents ${ids.contents} 0 R${annots} >>`,
    );
    const content = `q ${num(PAGE_WIDTH)} 0 0 ${num(height)} 0 0 cm /Im0 Do Q`;
    object(ids.contents, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    object(ids.image, [
      encoder.encode(
        `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      ),
      page.jpeg,
      encoder.encode('\nendstream'),
    ]);
    (page.links ?? []).forEach((link, i) => {
      const x1 = link.x * scale;
      const x2 = (link.x + link.width) * scale;
      const y1 = height - (link.y + link.height) * scale;
      const y2 = height - link.y * scale;
      object(
        ids.links[i],
        `<< /Type /Annot /Subtype /Link /Rect [${num(x1)} ${num(y1)} ${num(x2)} ${num(y2)}] /Border [0 0 0] /A << /S /URI /URI ${asciiString(link.url)} >> >>`,
      );
    });
  }

  const xref = length;
  push(`xref\n0 ${objectCount}\n0000000000 65535 f \n`);
  for (let id = 1; id < objectCount; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${objectCount} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

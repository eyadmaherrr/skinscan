import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { buildPdf } from '../lib/client/report-pdf';

describe('report PDF', () => {
  it('writes a valid PDF with one image per page and clickable links', async () => {
    const jpeg = new Uint8Array(await sharp({ create: { width: 124, height: 175, channels: 3, background: '#ffffff' } }).jpeg().toBuffer());
    const pdf = buildPdf(
      [
        { jpeg, pixelWidth: 124, pixelHeight: 175 },
        { jpeg, pixelWidth: 124, pixelHeight: 175, links: [{ url: 'https://www.drmahermahmoud.com/ar/book', x: 10, y: 20, width: 50, height: 10 }] },
      ],
      'SkinScan من د. ماهر — تقرير',
    );
    const text = Buffer.from(pdf).toString('latin1');

    assert.ok(text.startsWith('%PDF-1.4\n'));
    assert.ok(text.trimEnd().endsWith('%%EOF'));
    assert.match(text, /\/Type \/Pages \/Kids \[\S+ 0 R \S+ 0 R\] \/Count 2/);
    assert.equal((text.match(/\/Subtype \/Image/g) ?? []).length, 2);
    assert.match(text, /\/URI \(https:\/\/www\.drmahermahmoud\.com\/ar\/book\)/);
    assert.match(text, /\/Title <FEFF/); // Unicode title (Arabic)

    // Every cross-reference offset points at its object.
    const xrefAt = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    assert.ok(text.slice(xrefAt).startsWith('xref\n'));
    const entries = text.slice(xrefAt).split('\n').slice(3).filter((l) => / n $/.test(l));
    entries.forEach((line, i) => {
      const offset = Number(line.slice(0, 10));
      assert.ok(text.slice(offset).startsWith(`${i + 1} 0 obj`), `object ${i + 1}`);
    });

    // The image data is embedded unchanged.
    assert.ok(Buffer.from(pdf).includes(Buffer.from(jpeg)));
  });

  it('refuses an empty document', () => {
    assert.throws(() => buildPdf([], 'x'));
  });
});

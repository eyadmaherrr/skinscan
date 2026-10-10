import { ENGINE_NAME } from '../brand';
import { localeDir, type Locale } from '../i18n';
import { format, messages } from '../messages';
import { bookingLink } from './use-auth';
import { buildPdf, type PdfLink, type PdfPage } from './report-pdf';
import { METRIC_KEYS, type ScanSuccess } from '../skin-analysis/types';
import type { PreparedImage } from './prepare-image';

/**
 * The downloadable PDF report, created entirely in the browser: pages are
 * drawn on a canvas (A4 at 150 dpi) and wrapped into a PDF. Nothing is
 * uploaded; the photo stays on the device.
 */

const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN = 96;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const HEADER_BOTTOM = 190;
const FOOTER_TOP = PAGE_H - 110;

const NAVY = '#0b2d4d';
const BLUE = '#176b9c';
const TEXT = '#17212b';
const MUTED = '#667085';
const LINE = '#dde6ee';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

function canvasJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject) : reject(new Error('encode failed'))),
      'image/jpeg',
      0.9,
    ),
  );
}

class Pages {
  readonly pages: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; links: PdfLink[] }[] = [];
  y = 0;
  private readonly rtl: boolean;

  constructor(
    private readonly locale: Locale,
    private readonly fontFamily: string,
    private readonly drawHeader: (p: Pages) => void,
  ) {
    this.rtl = localeDir(locale) === 'rtl';
    this.newPage();
  }

  get ctx(): CanvasRenderingContext2D {
    return this.pages[this.pages.length - 1].ctx;
  }

  newPage(): void {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.direction = this.rtl ? 'rtl' : 'ltr';
    ctx.textBaseline = 'alphabetic';
    this.pages.push({ canvas, ctx, links: [] });
    this.y = 0;
    this.drawHeader(this);
    this.y = HEADER_BOTTOM;
  }

  /** Starts a new page when `height` more pixels do not fit. */
  ensure(height: number): void {
    if (this.y + height > FOOTER_TOP - 20) this.newPage();
  }

  /** Physical x of a point `offset` pixels from the start (left in English, right in Arabic) of the content area. */
  x(offset: number): number {
    return this.rtl ? PAGE_W - MARGIN - offset : MARGIN + offset;
  }

  /** Physical left edge of a box spanning [start, start + width] from the start side. */
  boxLeft(start: number, width: number): number {
    return this.rtl ? PAGE_W - MARGIN - start - width : MARGIN + start;
  }

  font(size: number, weight = 400): void {
    this.ctx.font = `${weight} ${size}px ${this.fontFamily}`;
  }

  /** Text at a logical offset; align 'end' places it against `offset` from the other side. */
  text(value: string, offset: number, y: number, opts: { size: number; weight?: number; color?: string; align?: 'start' | 'end' }): number {
    this.font(opts.size, opts.weight);
    this.ctx.fillStyle = opts.color ?? TEXT;
    this.ctx.textAlign = opts.align ?? 'start';
    this.ctx.fillText(value, this.x(offset), y);
    return this.ctx.measureText(value).width;
  }

  wrap(value: string, width: number, size: number, weight = 400): string[] {
    this.font(size, weight);
    const words = value.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && this.ctx.measureText(candidate).width > width) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
    return lines;
  }

  /** A wrapped paragraph that may continue on the next page. */
  paragraph(value: string, opts: { size: number; weight?: number; color?: string; offset?: number; width?: number; gap?: number }): void {
    const offset = opts.offset ?? 0;
    const lineHeight = Math.round(opts.size * 1.5);
    for (const line of this.wrap(value, opts.width ?? CONTENT_W - offset, opts.size, opts.weight)) {
      this.ensure(lineHeight);
      this.y += lineHeight;
      this.text(line, offset, this.y - Math.round(opts.size * 0.35), opts);
    }
    this.y += opts.gap ?? 0;
  }

  heading(value: string): void {
    this.ensure(90);
    this.y += 28;
    this.ctx.fillStyle = LINE;
    this.ctx.fillRect(MARGIN, this.y, CONTENT_W, 2);
    this.y += 44;
    this.text(value, 0, this.y, { size: 28, weight: 700, color: NAVY });
    this.y += 10;
  }

  bar(offset: number, width: number, y: number, fraction: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#e8eef3';
    ctx.fillRect(this.boxLeft(offset, width), y, width, 10);
    const filled = Math.max(4, Math.min(1, fraction) * width);
    ctx.fillStyle = BLUE;
    ctx.fillRect(this.boxLeft(offset, filled), y, filled, 10);
  }

  link(url: string, label: string, size: number): void {
    this.ensure(size * 2);
    this.y += Math.round(size * 1.5);
    const width = this.text(label, 0, this.y, { size, weight: 600, color: BLUE });
    const left = this.rtl ? this.x(0) - width : this.x(0);
    this.ctx.fillStyle = BLUE;
    this.ctx.fillRect(left, this.y + 4, width, 2);
    this.pages[this.pages.length - 1].links.push({ url, x: left, y: this.y - size, width, height: size + 8 });
  }
}

export async function downloadReport(result: ScanSuccess, photo: PreparedImage, locale: Locale): Promise<void> {
  const t = messages(locale);
  const interFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-inter').trim();
  // Arabic uses the same system fonts as drmahermahmoud.com's Arabic pages.
  const fontFamily =
    locale === 'ar'
      ? '"Segoe UI", Tahoma, Arial, sans-serif'
      : `${interFamily ? `${interFamily}, ` : ''}"Segoe UI", Arial, sans-serif`;
  await document.fonts?.ready;

  const [photoImg, logo] = await Promise.all([loadImage(photo.url), loadImage('/brand/logo.webp').catch(() => null)]);
  const date = new Date(result.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const pages = new Pages(locale, fontFamily, (p) => {
    const ctx = p.ctx;
    if (logo) ctx.drawImage(logo, p.boxLeft(0, 72), 64, 72, 72);
    p.text(t.siteName, 92, 96, { size: 30, weight: 700, color: NAVY });
    p.text(t.clinicName, 92, 128, { size: 19, weight: 600, color: BLUE });
    p.text(date, CONTENT_W, 110, { size: 19, color: MUTED, align: 'end' });
    ctx.fillStyle = LINE;
    ctx.fillRect(MARGIN, 160, CONTENT_W, 2);
  });

  // Title and scan details.
  pages.y += 64;
  pages.text(t.report.title, 0, pages.y, { size: 46, weight: 800, color: NAVY });
  pages.y += 16;
  pages.paragraph(`${t.report.scanId}: ${result.scanId.slice(0, 8)} · ${t.report.engine}: ${ENGINE_NAME}`, {
    size: 18,
    color: MUTED,
    gap: 24,
  });

  // Photo with the measured areas, and the overall confidence beside it.
  const photoW = 420;
  const photoH = Math.min(560, Math.round((photoW * photoImg.naturalHeight) / photoImg.naturalWidth));
  const drawW = Math.round((photoH * photoImg.naturalWidth) / photoImg.naturalHeight);
  pages.ensure(photoH + 40);
  const top = pages.y;
  const left = pages.boxLeft(0, drawW);
  const ctx = pages.ctx;
  ctx.drawImage(photoImg, left, top, drawW, photoH);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.fillStyle = 'rgba(45,156,219,0.16)';
  for (const r of result.regions) {
    ctx.beginPath();
    r.points.forEach(([x, y], i) => (i ? ctx.lineTo(left + x * drawW, top + y * photoH) : ctx.moveTo(left + x * drawW, top + y * photoH)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  const side = drawW + 48;
  const sideWidth = CONTENT_W - side;
  pages.text(`${Math.round(result.overallConfidence * 100)}%`, side, top + 64, { size: 56, weight: 800, color: BLUE });
  pages.y = top + 80;
  pages.paragraph(t.report.overall, { size: 22, weight: 700, color: NAVY, offset: side, width: sideWidth });
  pages.paragraph(t.results.overallSub, { size: 18, color: MUTED, offset: side, width: sideWidth, gap: 16 });
  if (result.imageQuality.notes.length) {
    pages.paragraph(t.report.notes, { size: 18, weight: 700, color: NAVY, offset: side, width: sideWidth });
    for (const note of result.imageQuality.notes) pages.paragraph(`• ${note}`, { size: 17, color: TEXT, offset: side, width: sideWidth });
  }
  pages.paragraph(t.report.photo, { size: 15, color: MUTED, offset: side, width: sideWidth });
  pages.y = Math.max(pages.y, top + photoH) + 8;

  // Core measurements.
  pages.heading(t.report.metrics);
  for (const key of METRIC_KEYS) {
    const m = result.analysis[key];
    pages.ensure(130);
    pages.y += 44;
    pages.text(t.metrics[key], 0, pages.y, { size: 23, weight: 700, color: NAVY });
    const score =
      m.score === null
        ? t.report.notScored
        : `${m.score}/100 · ${m.band ? t.bands[m.band] : ''} · ${t.confidence[m.confidenceLabel]}`;
    pages.text(score, CONTENT_W, pages.y, { size: 19, weight: 600, color: m.score === null ? MUTED : BLUE, align: 'end' });
    pages.y += 14;
    if (m.score !== null) pages.bar(0, CONTENT_W, pages.y, m.score / 100);
    pages.y += 10;
    pages.paragraph(m.explanation, { size: 18, color: '#475467' });
  }

  // Experimental sections.
  const acne = result.acne;
  if (acne) {
    pages.heading(t.report.acne);
    if (acne.status === 'ok') {
      const count = acne.lesionCandidateCount ?? 0;
      pages.paragraph(
        `${format(count === 1 ? t.acne.candidate : t.acne.candidates, { n: count })} · ${format(t.acne.tones, {
          red: acne.redToneCount ?? 0,
          dark: acne.darkToneCount ?? 0,
        })}`,
        { size: 20, weight: 700, color: NAVY },
      );
    }
    pages.paragraph(acne.explanation, { size: 18, color: '#475467', gap: 8 });
    const s = acne.severity;
    if (s.status === 'ok' && s.label) {
      pages.paragraph(t.report.severity, { size: 20, weight: 700, color: NAVY });
      const level = t.acne.levels[s.label] ?? s.label;
      pages.paragraph(s.confidenceLabel ? `${level} · ${t.confidence[s.confidenceLabel]}` : level, {
        size: 19,
        weight: 600,
        color: BLUE,
      });
      pages.paragraph(
        s.method === 'combined'
          ? `${t.acne.methodCombined} ${s.modelsAgree ? t.acne.agree : t.acne.disagree}`
          : format(t.acne.methodGrader, { n: s.components?.countGrader.inflammatoryLookingSpots ?? 0 }),
        { size: 17, color: MUTED },
      );
      pages.paragraph(t.acne.notice, { size: 17, color: MUTED });
    }
  }

  const age = result.skinAge;
  if (age && age.status === 'ok' && age.minYears !== null) {
    pages.heading(t.report.skinAge);
    pages.paragraph(
      age.maxYears === null ? format(t.skinAge.yearsPlus, { min: age.minYears }) : format(t.skinAge.years, { min: age.minYears, max: age.maxYears }),
      { size: 22, weight: 700, color: NAVY },
    );
    pages.paragraph(age.explanation, { size: 18, color: '#475467' });
    pages.paragraph(t.skinAge.notice, { size: 17, color: MUTED });
  }

  const uniformity = result.skinToneUniformity;
  if (uniformity && uniformity.status !== 'disabled') {
    pages.heading(t.skinToneUniformity.title);
    if (uniformity.status === 'ok' && uniformity.uniformityScore !== null) {
      if (uniformity.skinTone) {
        const tone = uniformity.skinTone;
        pages.paragraph(
          `${t.skinToneUniformity.toneLabel}: ${tone.toneLabel} (${tone.monk.name}) · ITA ${tone.ita}° · ${tone.undertoneLabel}`,
          { size: 21, weight: 700, color: NAVY },
        );
      }
      const bandLabel = uniformity.band ? t.skinToneUniformity[uniformity.band] : '';
      pages.paragraph(
        `${t.skinToneUniformity.scoreLabel}: ${uniformity.uniformityScore}/100${bandLabel ? ` · ${bandLabel}` : ''}`,
        { size: 20, weight: 600, color: BLUE },
      );
    }
    pages.paragraph(uniformity.explanation, { size: 18, color: '#475467' });
    pages.paragraph(t.skinToneUniformity.notice, { size: 17, color: MUTED });
  }

  // Disclaimer and booking.
  pages.heading(locale === 'ar' ? 'تنبيه' : 'Important');
  pages.paragraph(t.report.disclaimer, { size: 18, color: TEXT, gap: 6 });
  const booking = bookingLink(locale);
  pages.link(booking, format(t.report.book, { url: booking.replace(/^https?:\/\//, '') }), 19);

  // Footers, now that the page count is known.
  const total = pages.pages.length;
  pages.pages.forEach(({ ctx: c }, i) => {
    c.fillStyle = LINE;
    c.fillRect(MARGIN, FOOTER_TOP + 10, CONTENT_W, 2);
    c.font = `400 16px ${fontFamily}`;
    c.fillStyle = MUTED;
    c.textAlign = 'start';
    c.fillText(t.siteName, pages.x(0), FOOTER_TOP + 50);
    c.textAlign = 'end';
    c.fillText(format(t.report.page, { n: i + 1, total }), pages.x(CONTENT_W), FOOTER_TOP + 50);
  });

  const pdfPages: PdfPage[] = [];
  for (const { canvas, links } of pages.pages) {
    pdfPages.push({ jpeg: await canvasJpeg(canvas), pixelWidth: PAGE_W, pixelHeight: PAGE_H, links });
  }
  const pdf = buildPdf(pdfPages, `${t.siteName} — ${t.report.title}`);
  const url = URL.createObjectURL(new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${t.report.fileName}-${result.createdAt.slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

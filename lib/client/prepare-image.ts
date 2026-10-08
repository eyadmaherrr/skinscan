/**
 * Browser-side photo preparation before upload:
 *  - applies the camera orientation,
 *  - limits the size (keeps enough resolution for fine skin detail),
 *  - re-encodes as JPEG, which also drops all metadata (e.g. GPS location).
 * The original file never leaves the device.
 */

const MAX_SIDE = 2560;
const TARGET_BYTES = 3.5 * 1024 * 1024;

export interface PreparedImage {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

export class UnsupportedImageError extends Error {}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new UnsupportedImageError('decode failed'));
    img.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new UnsupportedImageError('encode failed'))), 'image/jpeg', quality),
  );
}

export async function prepareImage(source: Blob): Promise<PreparedImage> {
  const sourceUrl = URL.createObjectURL(source);
  try {
    const img = await loadImage(sourceUrl);
    let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    for (const quality of [0.92, 0.88, 0.85]) {
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new UnsupportedImageError('no canvas');
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await toBlob(canvas, quality);
      if (blob.size <= TARGET_BYTES || quality === 0.85) {
        return { blob, url: URL.createObjectURL(blob), width, height };
      }
      scale *= 0.85;
    }
    throw new UnsupportedImageError('could not prepare image');
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

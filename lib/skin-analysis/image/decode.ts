import sharp from 'sharp';
import { ScanError } from '../errors';

/** Interleaved 8-bit RGB image. */
export interface RgbImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export type SupportedImageType = 'jpeg' | 'png' | 'webp';

export const SUPPORTED_MIME_TYPES: Record<string, SupportedImageType> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/pjpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Identify the image format from its first bytes. The declared MIME type of
 * an upload is only a hint; this check decides what is actually parsed.
 */
export function sniffImageType(bytes: Uint8Array): SupportedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

export interface DecodeOptions {
  maxInputPixels: number;
  maxSide: number;
}

/**
 * Decode an uploaded image into sRGB pixels: applies the EXIF orientation,
 * converts embedded colour profiles to sRGB, flattens transparency, and
 * downsizes so the longest side is at most `maxSide`. Metadata (including
 * location data) is discarded — only pixels are kept.
 */
export async function decodeImage(buffer: Buffer, options: DecodeOptions): Promise<RgbImage> {
  const type = sniffImageType(buffer);
  if (!type) throw new ScanError('unsupported_type');
  try {
    const { data, info } = await sharp(buffer, {
      limitInputPixels: options.maxInputPixels,
      failOn: 'error',
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: options.maxSide,
        height: options.maxSide,
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3',
      })
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 3) throw new ScanError('image_unreadable', [], `unexpected channel count ${info.channels}`);
    return {
      data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    if (error instanceof ScanError) throw error;
    const message = error instanceof Error ? error.message : '';
    if (/pixel limit/i.test(message)) throw new ScanError('file_too_large', [], 'input pixel limit exceeded');
    throw new ScanError('image_unreadable', [], 'decode failed');
  }
}

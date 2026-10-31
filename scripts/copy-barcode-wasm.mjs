/**
 * Copies the ZXing barcode reader (WebAssembly, from the zxing-wasm package
 * that barcode-detector depends on) to public/vendor/, so browsers without a
 * built-in BarcodeDetector (Safari on iPhone) load it from this site instead
 * of a CDN (components/BarcodeScanner.tsx). Runs before `npm run dev` and
 * `npm run build`; the copy is not committed (.gitignore).
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
// The copy barcode-detector itself uses (resolved from its folder, in case of a nested install).
const detectorDir = path.dirname(require.resolve('barcode-detector/ponyfill'));
const source = require.resolve('zxing-wasm/reader/zxing_reader.wasm', { paths: [detectorDir] });
const target = path.join(process.cwd(), 'public', 'vendor', 'zxing_reader.wasm');

await mkdir(path.dirname(target), { recursive: true });
await copyFile(source, target);
console.log(`barcode reader: ${path.relative(process.cwd(), source)} -> ${path.relative(process.cwd(), target)}`);

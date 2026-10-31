/**
 * Retail barcodes (GTIN: EAN-13, EAN-8, UPC-A, UPC-E, GTIN-14). Safe to
 * import from client and server code: the barcode screen checks a typed
 * number before sending it, and the lookup route checks it again.
 */

/** GS1 check digit: weights 3,1,3,1… from the digit next to the check digit. */
function checkDigitOk(digits: string): boolean {
  let sum = 0;
  for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) sum += Number(digits[i]) * weight;
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/** UPC-E (8 digits, number system 0 or 1) → the UPC-A number it stands for. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [ns, d1, d2, d3, d4, d5, d6, check] = code;
  let body: string;
  if (d6 === '0' || d6 === '1' || d6 === '2') body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${ns}${body}${check}`;
}

/**
 * A typed or scanned code in the form product databases store it: EAN-8 as
 * 8 digits, everything else as a 13-digit GTIN (12-digit UPC-A gets a leading
 * zero, UPC-E is expanded first). Null when it is not a valid retail barcode.
 * Spaces and dashes are ignored. `format` is the camera's reading
 * ("upc_e"); an 8-digit typed number is read as EAN-8 when its check digit
 * fits, otherwise as UPC-E.
 */
export function normalizeBarcode(raw: string, format?: string): string | null {
  const digits = raw.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 8) {
    if (format !== 'upc_e' && checkDigitOk(digits)) return digits;
    const upcA = expandUpcE(digits);
    return upcA && checkDigitOk(upcA) ? upcA.padStart(13, '0') : null;
  }
  if (digits.length === 12 || digits.length === 13) return checkDigitOk(digits) ? digits.padStart(13, '0') : null;
  if (digits.length === 14) return checkDigitOk(digits) ? (digits.startsWith('0') ? digits.slice(1) : digits) : null;
  return null;
}

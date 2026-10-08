/**
 * Caps the number of scans processed at once by this server process. Image
 * analysis is CPU- and memory-heavy, so extra requests are turned away with a
 * friendly "busy" message instead of queueing up and timing out.
 */

const globalSlots = globalThis as unknown as { __skinScanActive?: { count: number } };
const active = (globalSlots.__skinScanActive ??= { count: 0 });

export function tryAcquire(max: number): (() => void) | null {
  if (active.count >= max) return null;
  active.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active.count--;
  };
}

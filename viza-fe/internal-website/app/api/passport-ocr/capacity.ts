import "server-only";

function maxConcurrency(): number {
  const configured = Number(process.env.PASSPORT_OCR_MAX_CONCURRENCY);
  return Number.isInteger(configured) && configured > 0 ? Math.min(configured, 16) : 4;
}

// Shared only within a warm function instance. Keep no queue or applicant data.
let active = 0;

export function tryAcquirePassportOcrCapacity(): (() => void) | null {
  if (active >= maxConcurrency()) return null;
  active += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active -= 1;
  };
}

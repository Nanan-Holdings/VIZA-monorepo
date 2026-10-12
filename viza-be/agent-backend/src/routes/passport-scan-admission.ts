import type { RequestHandler } from "express";

export function readPassportScanMaxInFlight(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const configured = Number(env.PASSPORT_SCAN_MAX_IN_FLIGHT);
  return Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 16)
    : 4;
}

/** Admit before body parsing; never queue large OCR payloads in this layer. */
export function createPassportScanAdmission(
  maxInFlight = readPassportScanMaxInFlight(),
): RequestHandler {
  if (!Number.isInteger(maxInFlight) || maxInFlight < 1 || maxInFlight > 16) {
    throw new Error("Invalid passport scan admission limit");
  }
  let inFlight = 0;

  return (req, res, next) => {
    if (inFlight >= maxInFlight) {
      // The unread upload must not keep this connection alive. Let the HTTP
      // response flush normally so callers receive the retryable error.
      res.set("Connection", "close")
        .set("Cache-Control", "no-store")
        .set("Retry-After", "2")
        .status(503)
        .json({ error: true, message: "OCR service is busy; retry shortly" });
      return;
    }

    inFlight += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      inFlight -= 1;
      req.removeListener("aborted", release);
      res.removeListener("finish", release);
      res.removeListener("close", release);
    };
    // req.close also fires after a complete upload, before OCR has finished;
    // only response completion/close or an aborted upload releases admission.
    req.once("aborted", release);
    res.once("finish", release);
    res.once("close", release);
    next();
  };
}

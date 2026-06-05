import type { JsonObject } from "../types.js";
import { redactToObject } from "../redaction.js";

export interface SafeScreenshotDescriptor {
  screenshotUrl: string | null;
  metadataRedactedJson: JsonObject;
}

export function describeSafeScreenshot(input: {
  screenshotUrl?: string | null;
  metadata?: JsonObject;
}): SafeScreenshotDescriptor {
  return {
    screenshotUrl: input.screenshotUrl ?? null,
    metadataRedactedJson: redactToObject(input.metadata ?? {}),
  };
}

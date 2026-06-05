import type { JsonObject } from "../types.js";
import { redactToObject } from "../redaction.js";

export function redactPlaywrightArtifactMetadata(value: unknown): JsonObject {
  return redactToObject(value);
}

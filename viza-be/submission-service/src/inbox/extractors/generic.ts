import type { ExtractorProfile } from "./types.js";

/**
 * Last-resort fallback when no provider profile claims the sender.
 * Pulls the first `\b\d{6}\b` it sees from text or html.
 */
export const genericProfile: ExtractorProfile = {
  id: "generic-6digit",
  senderDomains: [],
  extract: ({ text, html }) => {
    const haystack = [text ?? "", html ?? ""].join("\n");
    const m = /(?<![\w-])\d{6}(?![\w-])/.exec(haystack);
    return m ? { code: m[0] } : {};
  },
};

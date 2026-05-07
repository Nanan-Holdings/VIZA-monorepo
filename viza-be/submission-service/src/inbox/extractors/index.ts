import type { ExtractInput, ExtractResult, ExtractorProfile } from "./types.js";
import { genericProfile } from "./generic.js";
import { vfsGlobalProfile } from "./vfsglobal.js";
import { evisaGovVnProfile } from "./evisa-gov-vn.js";
import { ceacStateGovProfile } from "./ceac-state-gov.js";
import { govUkProfile } from "./gov-uk.js";

/**
 * Extractor registry (INBOX-004).
 *
 * `extract(input, profile?)` runs a specific profile.
 * `extractAuto(input)` picks the best profile by sender domain (and
 * optional subjectMatch), falling back to the generic 6-digit extractor
 * when no provider claims the domain.
 */

const PROFILES: ExtractorProfile[] = [
  vfsGlobalProfile,
  evisaGovVnProfile,
  ceacStateGovProfile,
  govUkProfile,
];

function senderDomain(from: string): string {
  const m = /<?([^<>@\s"']+@([^<>\s"']+))>?$/.exec(from.trim());
  return (m?.[2] ?? from.split("@").pop() ?? "").toLowerCase();
}

export function selectProfile(input: ExtractInput): ExtractorProfile {
  const domain = senderDomain(input.from);
  const candidates = PROFILES.filter((p) =>
    p.senderDomains.some((d) => domain === d || domain.endsWith(`.${d}`)),
  );
  const matched = candidates.find(
    (p) => !p.subjectMatch || p.subjectMatch.test(input.subject ?? ""),
  );
  return matched ?? genericProfile;
}

export function extract(
  input: ExtractInput,
  profile?: ExtractorProfile,
): ExtractResult {
  const p = profile ?? selectProfile(input);
  return p.extract(input);
}

export function extractAuto(input: ExtractInput): ExtractResult & { profileId: string } {
  const p = selectProfile(input);
  const result = p.extract(input);
  return { ...result, profileId: p.id };
}

export const inboxExtractors = {
  extract,
  extractAuto,
  selectProfile,
  profiles: PROFILES,
  generic: genericProfile,
};

export type { ExtractInput, ExtractResult, ExtractorProfile } from "./types.js";

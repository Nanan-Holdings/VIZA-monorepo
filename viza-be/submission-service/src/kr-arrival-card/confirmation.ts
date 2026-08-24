export function normalizeOfficialIssueNumber(candidate: string): string | null {
  const normalized = candidate.trim();
  if (!/^[A-Z0-9][A-Z0-9-]{5,63}$/iu.test(normalized)) return null;
  // On an unloaded completion page the `country/region` heading is the next
  // text after the empty Issue number cell. A real issue token always carries
  // at least one digit, whether it is numeric-only or alphanumeric.
  if (!/\d/u.test(normalized)) return null;
  return normalized;
}

export function extractOfficialIssueNumberFromText(pageText: string): string | null {
  const patterns = [
    /(?:issue|reference|confirmation)\s*(?:number|no\.?|id)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,63})/giu,
    /(?:发放编号|签发编号|发行编号|發放編號|簽發編號|發行編號|발급번호|신고번호|접수번호)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,63})/gu,
  ];
  for (const pattern of patterns) {
    for (const match of pageText.matchAll(pattern)) {
      const issueNumber = normalizeOfficialIssueNumber(match[1] ?? "");
      if (issueNumber) return issueNumber;
    }
  }
  return null;
}

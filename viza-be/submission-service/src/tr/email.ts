import type { InboundMessage } from "../inbox/wait-for-message.js";
import {
  extractTrApplicationReference,
  isTrustedTrOfficialUrl,
  normalizeTrApplicationReference,
} from "./live-flow.js";

function decodeMessageBody(value: string): string {
  return value
    .replace(/=3D/gi, "=")
    .replace(/&amp;/gi, "&")
    .replace(/&#x3D;|&#61;/gi, "=")
    .replace(/=\r?\n/g, "");
}

export function extractTrVerificationUrl(message: Pick<InboundMessage, "text" | "html">): string | null {
  const body = decodeMessageBody(`${message.text ?? ""}\n${message.html ?? ""}`);
  const urls = body.match(/https:\/\/[^\s<>"']+/gi) ?? [];
  for (const candidate of urls) {
    const cleaned = candidate.replace(/[),.;]+$/, "");
    if (!isTrustedTrOfficialUrl(cleaned)) continue;
    const path = new URL(cleaned).pathname.toLowerCase();
    if (/\/(?:email|verify|verification|approve|payment)\//.test(path)) return cleaned;
  }
  return null;
}

function headerValue(headers: InboundMessage["headers"], name: string): string {
  if (!headers) return "";
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return typeof entry?.[1] === "string" ? entry[1] : "";
}

function singleHeaderDomain(value: string): string | null {
  const domains = [...value.toLowerCase().matchAll(/@([a-z0-9.-]+)/g)]
    .map((match) => match[1].replace(/\.+$/, ""));
  return domains.length === 1 ? domains[0] : null;
}

function officialTrMailDomain(value: string | null): boolean {
  return value === "evisa.gov.tr" || Boolean(value?.endsWith(".evisa.gov.tr"));
}

function domainsAlign(left: string, right: string): boolean {
  const a = left.trim().replace(/\.$/, "").toLowerCase();
  const b = right.trim().replace(/\.$/, "").toLowerCase();
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

/**
 * Authentication-Results is a sequence of semicolon-delimited method clauses.
 * Keep the identity in the same clause as its pass result so an unrelated
 * passing signature cannot bless a forged, failing official-domain signature.
 */
function authMethodDomains(
  authenticationResult: string,
  method: "dkim" | "dmarc",
  property: "header.d" | "header.from",
): string[] {
  const methodPattern = new RegExp(`(?:^|;)\\s*${method}=pass\\b([^;]*)`, "gi");
  const domains: string[] = [];
  for (const match of authenticationResult.matchAll(methodPattern)) {
    const propertyPattern = new RegExp(
      `\\b${property.replace(".", "\\.")}=([a-z0-9.-]+)`,
      "gi",
    );
    for (const propertyMatch of (match[1] ?? "").matchAll(propertyPattern)) {
      domains.push(propertyMatch[1].replace(/\.+$/, "").toLowerCase());
    }
  }
  return domains;
}

/**
 * Trust only the single receiver-authenticated Cloudflare result. The inbound
 * parser preserves duplicate Authentication-Results fields on separate lines;
 * rejecting duplicates prevents a sender-supplied lookalike result from being
 * combined with Cloudflare's real failure result.
 */
export function hasTrustedTrMailAuthentication(message: InboundMessage): boolean {
  const fromDomain = singleHeaderDomain(headerValue(message.headers, "from"));
  if (!fromDomain || !officialTrMailDomain(fromDomain)) return false;

  const trustedResults = headerValue(message.headers, "authentication-results")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^mx\.cloudflare\.net\s*;/i.test(line));
  if (trustedResults.length !== 1) return false;

  const result = trustedResults[0];
  const dkimDomains = authMethodDomains(result, "dkim", "header.d");
  const dmarcDomains = authMethodDomains(result, "dmarc", "header.from");
  return (
    dkimDomains.some(
      (domain) => officialTrMailDomain(domain) && domainsAlign(domain, fromDomain),
    ) &&
    dmarcDomains.some(
      (domain) => officialTrMailDomain(domain) && domainsAlign(domain, fromDomain),
    )
  );
}

export function isTrVerificationEmail(
  message: InboundMessage,
  applicationReference: string,
): boolean {
  const subject = message.subject?.trim().toLowerCase() ?? "";
  const expectedSubject = /e-?mail address verification|e-?visa.*verification/.test(subject);
  const expectedReference = normalizeTrApplicationReference(applicationReference);
  const messageText = decodeMessageBody(
    `${message.subject ?? ""}\n${message.text ?? ""}\n${message.html ?? ""}`,
  );
  const messageReference = extractTrApplicationReference(messageText);
  const referenceMatches = Boolean(expectedReference) && messageReference === expectedReference;
  return (
    expectedSubject &&
    referenceMatches &&
    hasTrustedTrMailAuthentication(message) &&
    extractTrVerificationUrl(message) !== null
  );
}

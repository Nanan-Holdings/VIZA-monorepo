import { inbox, type InboundMessage } from "../inbox/wait-for-message.js";
import { extractAuto } from "../inbox/extractors/index.js";
import { storeEvisaArtifact } from "./evisa-artifact.js";

/**
 * Generalized inbox e-visa retrieval (RUN-CORE-008).
 *
 * For email-delivery countries (ID/TR/TH/AE/…), the e-visa PDF arrives by
 * email after government payment. This generalizes the Vietnam pattern:
 * wait for the country's email, extract the result link/reference, download
 * the PDF, and store it via the shared artifact path (RUN-CORE-003).
 */

export interface CountryInboxConfig {
  country: string;
  /** Sender domain/pattern the e-visa email comes from. */
  fromPattern: RegExp;
  /** Subject pattern identifying the e-visa delivery. */
  subjectPattern: RegExp;
}

export const EVISA_INBOX_CONFIGS: Record<string, CountryInboxConfig> = {
  indonesia: { country: "indonesia", fromPattern: /imigrasi\.go\.id$/i, subjectPattern: /(e-?visa|visa approval|izin tinggal)/i },
  turkey: { country: "turkey", fromPattern: /evisa\.gov\.tr$/i, subjectPattern: /(e-?visa|application result)/i },
  thailand: { country: "thailand", fromPattern: /thaievisa\.go\.th$/i, subjectPattern: /(e-?visa|visa approval)/i },
  united_arab_emirates: { country: "united_arab_emirates", fromPattern: /(icp\.gov\.ae|gdrfad\.gov\.ae)$/i, subjectPattern: /(e-?visa|entry permit)/i },
};

/** Pure predicate — does this message look like the country's e-visa delivery? */
export function matchesEvisaEmail(cfg: CountryInboxConfig, msg: InboundMessage): boolean {
  return cfg.fromPattern.test(msg.from_addr) && cfg.subjectPattern.test(msg.subject ?? "");
}

export interface RetrieveEvisaInput {
  applicantId: string;
  applicationId: string;
  jobId: string;
  country: string;
  timeoutMs?: number;
}

export interface RetrievedEvisa {
  storagePath: string | null;
  reference: string | null;
  link: string | null;
}

export async function retrieveEvisaFromInbox(input: RetrieveEvisaInput): Promise<RetrievedEvisa> {
  const cfg = EVISA_INBOX_CONFIGS[input.country];
  if (!cfg) {
    throw new Error(`[evisa-inbox] no inbox config for country '${input.country}'`);
  }
  const message = await inbox.waitForMessage(
    input.applicantId,
    (m) => matchesEvisaEmail(cfg, m),
    input.timeoutMs ?? 60_000,
  );
  const parsed = extractAuto({
    from: message.from_addr,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  let storagePath: string | null = null;
  if (parsed.link) {
    const res = await fetch(parsed.link);
    if (res.ok) {
      const data = Buffer.from(await res.arrayBuffer());
      storagePath = await storeEvisaArtifact({
        applicationId: input.applicationId,
        jobId: input.jobId,
        country: input.country,
        data,
      });
    } else {
      console.warn(`[evisa-inbox] ${input.country} result link fetch failed: ${res.status}`);
    }
  }

  return { storagePath, reference: parsed.reference ?? null, link: parsed.link ?? null };
}

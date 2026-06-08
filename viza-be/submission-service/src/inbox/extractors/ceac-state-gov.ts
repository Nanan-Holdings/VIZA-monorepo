import type { ExtractorProfile } from "./types";

/**
 * US CEAC DS-160 application id mails from `state.gov` /
 * `donotreply.state.gov`. The DS-160 flow does not send OTPs; the
 * artefact we care about is the application id (e.g. `AA00ABC123`)
 * embedded in the confirmation summary the portal can email.
 */
export const ceacStateGovProfile: ExtractorProfile = {
  id: "ceac-state-gov",
  senderDomains: ["state.gov", "donotreply.state.gov"],
  extract: ({ subject, text, html }) => {
    const haystack = [subject ?? "", text ?? "", html ?? ""].join("\n");
    const reference =
      /\bAA[0-9A-Z]{8,12}\b/.exec(haystack)?.[0] ??
      /application\s+id[^A-Z0-9]{0,8}([A-Z0-9]{6,16})/i.exec(haystack)?.[1];
    const link = /https?:\/\/[^\s"'<>]*ceac\.state\.gov[^\s"'<>]+/i.exec(haystack)?.[0];
    return { reference, link };
  },
};

import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesEvisaEmail, EVISA_INBOX_CONFIGS } from "../evisa-inbox.js";
import type { InboundMessage } from "../../inbox/wait-for-message.js";

function msg(from: string, subject: string): InboundMessage {
  return {
    id: "m1", to_addr: "applicant@viza", from_addr: from, subject,
    message_id: null, text: "Your e-visa is attached.", html: null,
    headers: null, raw_size: 0, r2_key: null, spam_score: null,
    received_at: "2026-06-04T00:00:00Z", processed: false,
  };
}

/** RUN-CORE-008: parse/match one fixture e-visa email (Türkiye). */
test("evisa-inbox: matches a Türkiye e-visa delivery email", () => {
  const cfg = EVISA_INBOX_CONFIGS.turkey;
  assert.ok(matchesEvisaEmail(cfg, msg("noreply@evisa.gov.tr", "Your e-Visa application result")));
});

test("evisa-inbox: rejects wrong sender or unrelated subject", () => {
  const cfg = EVISA_INBOX_CONFIGS.turkey;
  assert.equal(matchesEvisaEmail(cfg, msg("spam@example.com", "Your e-Visa")), false);
  assert.equal(matchesEvisaEmail(cfg, msg("noreply@evisa.gov.tr", "Newsletter")), false);
});

test("evisa-inbox: configs present for the email-delivery countries", () => {
  for (const c of ["indonesia", "turkey", "thailand", "united_arab_emirates"]) {
    assert.ok(EVISA_INBOX_CONFIGS[c], `config for ${c}`);
  }
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InboundMessage } from "../../inbox/wait-for-message";

type TwInboxModule = typeof import("../inbox");

function fixture(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: "fake-message-id-001",
    to_addr: "tw-test-applicant@example.invalid",
    from_addr: "no-reply@immigration.gov.tw",
    subject: "境外人士线上申办系统 邮箱验证",
    message_id: "<fake-message-id-001@example.invalid>",
    text: "您好：\n验证码：A1B2C3D4E5F6G7H\n有效期为 30 分钟。",
    html: null,
    headers: null,
    raw_size: 256,
    r2_key: null,
    spam_score: null,
    received_at: "2026-08-01T00:00:00.000Z",
    processed: false,
    ...overrides,
  };
}

describe("Taiwan application-form email verification parser", () => {
  it("matches official sender, Taiwan verification subject, and extracts the labeled mixed token", async () => {
    const { extractTwVerificationCode, isTwVerificationEmail } = await loadTwInboxModule();
    const message = fixture();

    assert.equal(isTwVerificationEmail(message), true);
    assert.equal(extractTwVerificationCode(message), "A1B2C3D4E5F6G7H");
  });

  it("preserves the original mixed-case token exactly", async () => {
    const { extractTwVerificationCode, isTwVerificationEmail } = await loadTwInboxModule();
    const token = "Ab3cD4eFg5HiJ6k";
    const message = fixture({
      text: `您好：\n验证码：${token}\n有效期为 30 分钟。`,
    });

    assert.equal(isTwVerificationEmail(message), true);
    assert.equal(extractTwVerificationCode(message), token);
  });

  it("accepts an official subdomain sender and traditional verification label", async () => {
    const { extractTwVerificationCode, isTwVerificationEmail } = await loadTwInboxModule();
    const message = fixture({
      from_addr: "境外人士线上申办系统 <service@coa.immigration.gov.tw>",
      subject: "境外人士線上申辦系統 驗證通知",
      text: "驗證碼：ZX9Y8X7W6V5U4T3\n請於 30 分鐘內使用。",
    });

    assert.equal(isTwVerificationEmail(message), true);
    assert.equal(extractTwVerificationCode(message), "ZX9Y8X7W6V5U4T3");
  });

  it("rejects the right-looking subject from a non-official sender", async () => {
    const { extractTwVerificationCode, isTwVerificationEmail } = await loadTwInboxModule();
    const message = fixture({ from_addr: "notice@example.invalid" });

    assert.equal(isTwVerificationEmail(message), false);
    assert.equal(extractTwVerificationCode(message), "A1B2C3D4E5F6G7H");
  });

  it("rejects unrelated official-domain messages even when they contain numbers", async () => {
    const { extractTwVerificationCode, isTwVerificationEmail } = await loadTwInboxModule();
    const message = fixture({
      subject: "境外人士线上申办系统 案件通知",
      text: "案件编号：123456789012345\n请稍后查看。",
    });

    assert.equal(isTwVerificationEmail(message), false);
    assert.equal(extractTwVerificationCode(message), null);
  });

  it("rejects Taiwan-system messages without an explicit verification-code label", async () => {
    const { extractTwVerificationCode, isTwVerificationEmail } = await loadTwInboxModule();
    const message = fixture({
      text: "您好：\nA1B2C3D4E5F6G7H\n有效期为 30 分钟。",
    });

    assert.equal(isTwVerificationEmail(message), false);
    assert.equal(extractTwVerificationCode(message), null);
  });

  it("does not treat a subject label as a body verification-code label", async () => {
    const { extractTwVerificationCode, isTwVerificationEmail } = await loadTwInboxModule();
    const message = fixture({
      subject: "境外人士线上申办系统 邮箱验证码",
      text: "您好：\nA1B2C3D4E5F6G7H\n有效期为 30 分钟。",
    });

    assert.equal(isTwVerificationEmail(message), false);
    assert.equal(extractTwVerificationCode(message), null);
  });

  it("skips explanatory verification-code wording before the real labeled token", async () => {
    const { extractTwVerificationCode, isTwVerificationEmail } = await loadTwInboxModule();
    const message = fixture({
      text: "",
      html: [
        "您好：<br />請複製下方驗證碼至您的驗證頁。",
        "<br />請於30分鐘內完成驗證。",
        "<br />驗證碼：AB12CD34EF56GH7",
      ].join(""),
    });

    assert.equal(isTwVerificationEmail(message), true);
    assert.equal(extractTwVerificationCode(message), "AB12CD34EF56GH7");
  });

  it("does not use a broad pure-number fallback for unrelated identifiers", async () => {
    const { extractTwVerificationCode, isTwVerificationEmail } = await loadTwInboxModule();
    const message = fixture({
      text: "您好：\n验证码：123456789012345\n案件编号：987654321098765。",
    });

    assert.equal(isTwVerificationEmail(message), true);
    assert.equal(extractTwVerificationCode(message), null);
  });
});

async function loadTwInboxModule(): Promise<TwInboxModule> {
  process.env.SUPABASE_URL ??= "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
  return import("../inbox");
}

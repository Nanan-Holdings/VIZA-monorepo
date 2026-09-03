import { beforeEach, describe, expect, it, vi } from "vitest";

const getClientSessionWithFallback = vi.hoisted(() => vi.fn());
const withAdmin = vi.hoisted(() => vi.fn());
const presignR2Get = vi.hoisted(() => vi.fn());
const generateInboxAiMeta = vi.hoisted(() => vi.fn());
const isInboxAiConfigured = vi.hoisted(() => vi.fn(() => true));
const buildAttachmentsMeta = vi.hoisted(() => vi.fn());
const extractAttachmentPart = vi.hoisted(() => vi.fn());
const translateManyWithGoogleV2 = vi.hoisted(() => vi.fn());
const consumeFormAssistantRateLimit = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/lib/client-session", () => ({ getClientSessionWithFallback }));
vi.mock("@/lib/auth/with-admin", () => ({ withAdmin }));
vi.mock("@/lib/inbox/r2-presign", () => ({ presignR2Get }));
vi.mock("@/lib/inbox/ai-summary", () => ({
  generateInboxAiMeta,
  isInboxAiConfigured,
}));
vi.mock("@/lib/inbox/attachments", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/inbox/attachments")
  >("@/lib/inbox/attachments");
  return {
    isAttachmentsMeta: actual.isAttachmentsMeta,
    buildAttachmentsMeta,
    extractAttachmentPart,
  };
});
vi.mock("@/lib/translation/google-translate-v2", () => ({
  translateManyWithGoogleV2,
}));
vi.mock("@/lib/form-assistant/rate-limit", () => ({
  consumeFormAssistantRateLimit,
}));

import {
  ensureInboxAiSummary,
  ensureInboxTranslation,
  getClientInboxOverview,
  getInboundEmailAttachment,
  queueInboxReply,
  setInboxMessageArchived,
  setInboxMessageRead,
} from "./inbox";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function query(result: QueryResult) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function installAdmin(queries: Record<string, ReturnType<typeof query>[]>) {
  const offsets = new Map<string, number>();
  const admin = {
    from: vi.fn((table: string) => {
      const offset = offsets.get(table) ?? 0;
      offsets.set(table, offset + 1);
      const next = queries[table]?.[offset];
      if (!next) throw new Error(`Unexpected ${table} query ${offset + 1}`);
      return next;
    }),
  };
  withAdmin.mockImplementation(
    async (
      _mode: string,
      _actor: string,
      callback: (client: typeof admin) => unknown,
    ) => callback(admin),
  );
  return admin;
}

const ACTIVE_PROFILE = {
  data: {
    id: "profile-id",
    inbox_alias: "owner@viza.it.com",
    inbox_alias_retired_at: null,
  },
  error: null,
};

function sessionActive() {
  getClientSessionWithFallback.mockResolvedValue({
    userId: "profile-id",
    email: "user@example.com",
    authUserId: "auth-id",
  });
}

describe("client mailbox actions", () => {
  beforeEach(() => {
    getClientSessionWithFallback.mockReset();
    withAdmin.mockReset();
    presignR2Get.mockReset();
    generateInboxAiMeta.mockReset();
    isInboxAiConfigured.mockReset();
    isInboxAiConfigured.mockReturnValue(true);
    buildAttachmentsMeta.mockReset();
    extractAttachmentPart.mockReset();
    translateManyWithGoogleV2.mockReset();
    consumeFormAssistantRateLimit.mockReset();
    consumeFormAssistantRateLimit.mockReturnValue(true);
  });

  it("requires a session before any service-role access", async () => {
    getClientSessionWithFallback.mockResolvedValue(null);
    await expect(getClientInboxOverview()).rejects.toThrow(
      "Authentication required",
    );
    await expect(setInboxMessageRead("m1", true)).rejects.toThrow(
      "Authentication required",
    );
    expect(withAdmin).not.toHaveBeenCalled();
  });

  it("returns a setup-state overview when no active alias exists", async () => {
    sessionActive();
    const retired = query({
      data: {
        id: "profile-id",
        inbox_alias: "gone@viza.it.com",
        inbox_alias_retired_at: "2026-08-01T00:00:00.000Z",
      },
      error: null,
    });
    installAdmin({ applicant_profiles: [retired] });

    await expect(getClientInboxOverview()).resolves.toEqual({
      alias: null,
      items: [],
    });
  });

  it("maps rows into categorized list items and keeps the quarantine fence", async () => {
    sessionActive();
    const profile = query(ACTIVE_PROFILE);
    const rows = query({
      data: [
        {
          id: "m1",
          from_addr: "visa.singapore@kemlu.go.id",
          subject: "Additional document required",
          text: "Please provide a bank statement within 7 calendar days.",
          html: null,
          r2_key: "inbound/owner/m1.eml",
          received_at: "2026-08-29T01:00:00.000Z",
          read_at: null,
          starred: false,
          archived_at: null,
          ai_meta: null,
          attachments_meta: null,
        },
        {
          id: "m2",
          from_addr: "hello@viza.sg",
          subject: "Welcome",
          text: "Your address is live.",
          html: null,
          r2_key: null,
          received_at: "2026-08-28T01:00:00.000Z",
          read_at: "2026-08-28T02:00:00.000Z",
          starred: true,
          archived_at: "2026-08-28T03:00:00.000Z",
          ai_meta: {
            v: 1,
            lang: "en",
            model: "test",
            generatedAt: "2026-08-28T02:00:00.000Z",
            summary: "Welcome mail.",
            details: [],
            category: "viza",
            needsAction: false,
          },
          attachments_meta: {
            v: 1,
            parsedAt: "2026-08-28T02:00:00.000Z",
            attachments: [
              { index: 0, filename: "a.pdf", mimeType: "application/pdf", size: 10 },
            ],
          },
        },
      ],
      error: null,
    });
    installAdmin({ applicant_profiles: [profile], inbound_email: [rows] });

    const overview = await getClientInboxOverview(50);
    expect(overview.alias).toBe("owner@viza.it.com");
    expect(rows.eq).toHaveBeenCalledWith("to_addr", "owner@viza.it.com");
    expect(rows.eq).toHaveBeenCalledWith("quarantined", false);
    expect(rows.limit).toHaveBeenCalledWith(50);

    const [first, second] = overview.items;
    expect(first).toMatchObject({
      id: "m1",
      category: "documents",
      needsAction: true,
      read: false,
      starred: false,
      archived: false,
      hasOriginal: true,
      attachmentCount: null,
    });
    expect(first.snippet).toContain("bank statement");
    expect(second).toMatchObject({
      id: "m2",
      category: "viza",
      needsAction: false,
      read: true,
      starred: true,
      archived: true,
      hasOriginal: false,
      attachmentCount: 1,
    });
  });

  it("binds state updates to the owning alias and rejects invisible rows", async () => {
    sessionActive();
    const profile = query(ACTIVE_PROFILE);
    const update = query({ data: [], error: null });
    installAdmin({ applicant_profiles: [profile], inbound_email: [update] });

    await expect(setInboxMessageArchived("other-message", true)).rejects.toThrow(
      "Message not found or not visible to caller",
    );
    expect(update.eq).toHaveBeenCalledWith("id", "other-message");
    expect(update.eq).toHaveBeenCalledWith("to_addr", "owner@viza.it.com");
    expect(update.eq).toHaveBeenCalledWith("quarantined", false);
  });

  it("queues a reply against the owned message with the applicant id", async () => {
    sessionActive();
    const profile = query(ACTIVE_PROFILE);
    const owned = query({ data: { id: "m1" }, error: null });
    const inserted = query({
      data: {
        id: "r1",
        kind: "reply",
        body: "Thank you, uploading now.",
        status: "queued",
        created_at: "2026-08-29T02:00:00.000Z",
      },
      error: null,
    });
    installAdmin({
      applicant_profiles: [profile],
      inbound_email: [owned],
      inbound_email_replies: [inserted],
    });

    const result = await queueInboxReply("m1", "Thank you, uploading now.");
    expect(result).toEqual({
      ok: true,
      reply: expect.objectContaining({ id: "r1", status: "queued" }),
    });
    expect(inserted.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        email_id: "m1",
        applicant_id: "profile-id",
        kind: "reply",
        status: "queued",
        body: "Thank you, uploading now.",
      }),
    );
  });

  it("rejects an empty reply before any lookup", async () => {
    sessionActive();
    await expect(queueInboxReply("m1", "   ")).resolves.toEqual({
      ok: false,
      code: "empty",
    });
    expect(withAdmin).not.toHaveBeenCalled();
  });

  it("returns the cached AI reading without calling the model again", async () => {
    sessionActive();
    const cached = {
      v: 1,
      lang: "zh",
      model: "test",
      generatedAt: "2026-08-29T00:00:00.000Z",
      summary: "已缓存的解读。",
      details: [{ label: "截止日期", value: "9月5日" }],
      category: "documents",
      needsAction: true,
    };
    const profile = query(ACTIVE_PROFILE);
    const row = query({
      data: {
        id: "m1",
        from_addr: "a@b.c",
        subject: "s",
        text: "body",
        html: null,
        ai_meta: cached,
      },
      error: null,
    });
    installAdmin({ applicant_profiles: [profile], inbound_email: [row] });

    await expect(ensureInboxAiSummary("m1", "zh-CN")).resolves.toEqual({
      ok: true,
      ai: expect.objectContaining({ summary: "已缓存的解读。", lang: "zh" }),
    });
    expect(generateInboxAiMeta).not.toHaveBeenCalled();
  });

  it("reports the AI reading as unavailable when no key is configured", async () => {
    sessionActive();
    isInboxAiConfigured.mockReturnValue(false);
    await expect(ensureInboxAiSummary("m1", "en")).resolves.toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(withAdmin).not.toHaveBeenCalled();
  });

  it("translates uncached bodies through Google and persists the result", async () => {
    sessionActive();
    const profile = query(ACTIVE_PROFILE);
    const row = query({
      data: {
        id: "m1",
        text: "First paragraph.\n\nSecond paragraph.",
        html: null,
        translations: null,
      },
      error: null,
    });
    const persist = query({ data: [{ id: "m1" }], error: null });
    installAdmin({
      applicant_profiles: [profile],
      inbound_email: [row, persist],
    });
    translateManyWithGoogleV2.mockResolvedValue({
      ok: true,
      translatedTexts: ["第一段。", "第二段。"],
      detectedSourceLanguages: ["en", "en"],
      provider: "google",
    });

    await expect(ensureInboxTranslation("m1", "zh")).resolves.toEqual({
      ok: true,
      paragraphs: ["第一段。", "第二段。"],
    });
    expect(translateManyWithGoogleV2).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "zh-CN" }),
    );
    expect(persist.update).toHaveBeenCalledWith(
      expect.objectContaining({
        translations: expect.objectContaining({
          zh: expect.objectContaining({ paragraphs: ["第一段。", "第二段。"] }),
        }),
      }),
    );
  });

  it("refuses attachment downloads for messages without a stored original", async () => {
    sessionActive();
    const profile = query(ACTIVE_PROFILE);
    const row = query({ data: { id: "m1", r2_key: null }, error: null });
    installAdmin({ applicant_profiles: [profile], inbound_email: [row] });

    await expect(getInboundEmailAttachment("m1", 0)).resolves.toBeNull();
    expect(extractAttachmentPart).not.toHaveBeenCalled();
  });
});

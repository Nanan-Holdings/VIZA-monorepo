import { beforeEach, describe, expect, it, vi } from "vitest";

const getClientSessionWithFallback = vi.hoisted(() => vi.fn());
const withAdmin = vi.hoisted(() => vi.fn());
const presignR2Get = vi.hoisted(() => vi.fn());

vi.mock("@/lib/client-session", () => ({ getClientSessionWithFallback }));
vi.mock("@/lib/auth/with-admin", () => ({ withAdmin }));
vi.mock("@/lib/inbox/r2-presign", () => ({ presignR2Get }));

import { getInboundEmailDownloadUrl, listClientInbox } from "./inbox";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function query(result: QueryResult) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(result)),
    maybeSingle: vi.fn().mockResolvedValue(result),
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
    async (_mode: string, _actor: string, callback: (client: typeof admin) => unknown) =>
      callback(admin),
  );
  return admin;
}

describe("applicant inbox authorization", () => {
  beforeEach(() => {
    getClientSessionWithFallback.mockReset();
    withAdmin.mockReset();
    presignR2Get.mockReset();
  });

  it("rejects both reads before service-role access when no applicant session exists", async () => {
    getClientSessionWithFallback.mockResolvedValue(null);

    await expect(listClientInbox()).rejects.toThrow("Authentication required");
    await expect(getInboundEmailDownloadUrl("message-id")).rejects.toThrow(
      "Authentication required",
    );
    expect(withAdmin).not.toHaveBeenCalled();
  });

  it("resolves a legacy auth UUID and lists only its active, non-quarantined alias", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "legacy-auth-id",
      email: "user@example.com",
    });
    const byProfileId = query({ data: null, error: null });
    const byAuthUserId = query({
      data: {
        id: "profile-id",
        inbox_alias: "Appl-Owner@Viza.It.Com",
        inbox_alias_retired_at: null,
      },
      error: null,
    });
    const inboxRows = [{ id: "message-id", to_addr: "appl-owner@viza.it.com" }];
    const inboxQuery = query({ data: inboxRows, error: null });
    installAdmin({
      applicant_profiles: [byProfileId, byAuthUserId],
      inbound_email: [inboxQuery],
    });

    await expect(listClientInbox(25)).resolves.toEqual(inboxRows);
    expect(byProfileId.eq).toHaveBeenCalledWith("id", "legacy-auth-id");
    expect(byAuthUserId.eq).toHaveBeenCalledWith("auth_user_id", "legacy-auth-id");
    expect(inboxQuery.eq).toHaveBeenCalledWith("to_addr", "appl-owner@viza.it.com");
    expect(inboxQuery.eq).toHaveBeenCalledWith("quarantined", false);
    expect(inboxQuery.limit).toHaveBeenCalledWith(25);
  });

  it("returns no client rows when the owning alias is absent or retired", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "profile-id",
      email: "user@example.com",
      authUserId: "auth-id",
    });
    const retiredProfile = query({
      data: {
        id: "profile-id",
        inbox_alias: "retired@viza.it.com",
        inbox_alias_retired_at: "2026-08-23T00:00:00.000Z",
      },
      error: null,
    });
    const admin = installAdmin({ applicant_profiles: [retiredProfile] });

    await expect(listClientInbox()).resolves.toEqual([]);
    expect(admin.from).not.toHaveBeenCalledWith("inbound_email");
  });

  it("binds download lookup to the active alias and refuses invisible rows", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "profile-id",
      email: "user@example.com",
      authUserId: "auth-id",
    });
    const profile = query({
      data: {
        id: "profile-id",
        inbox_alias: "owner@viza.it.com",
        inbox_alias_retired_at: null,
      },
      error: null,
    });
    const hiddenMessage = query({ data: null, error: null });
    installAdmin({ applicant_profiles: [profile], inbound_email: [hiddenMessage] });

    await expect(getInboundEmailDownloadUrl("other-message")).rejects.toThrow(
      "Message not found or not visible to caller",
    );
    expect(hiddenMessage.eq).toHaveBeenCalledWith("id", "other-message");
    expect(hiddenMessage.eq).toHaveBeenCalledWith("to_addr", "owner@viza.it.com");
    expect(hiddenMessage.eq).toHaveBeenCalledWith("quarantined", false);
    expect(presignR2Get).not.toHaveBeenCalled();
  });

  it("presigns an owned non-quarantined R2 message for five minutes", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "profile-id",
      email: "user@example.com",
      authUserId: "auth-id",
    });
    const profile = query({
      data: {
        id: "profile-id",
        inbox_alias: "owner@viza.it.com",
        inbox_alias_retired_at: null,
      },
      error: null,
    });
    const ownedMessage = query({
      data: { id: "message-id", r2_key: "mail/profile/message.eml" },
      error: null,
    });
    installAdmin({ applicant_profiles: [profile], inbound_email: [ownedMessage] });
    presignR2Get.mockReturnValue("https://download.example/signed");

    await expect(getInboundEmailDownloadUrl("message-id")).resolves.toEqual({
      url: "https://download.example/signed",
      expiresIn: 300,
    });
    expect(presignR2Get).toHaveBeenCalledWith({
      key: "mail/profile/message.eml",
      expiresIn: 300,
    });
  });
});

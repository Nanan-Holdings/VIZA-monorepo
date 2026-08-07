import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, getUserFromSupabaseSession } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getUserFromSupabaseSession: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/client-session", () => ({ getUserFromSupabaseSession }));

import { POST } from "./route";

const application = { id: "application-id", applicant_id: "profile-id" };

function query(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

function requestWithFile(file?: File, language?: string): Request {
  const input = file
    ? {
        name: file.name,
        size: file.size,
        type: file.type,
        arrayBuffer: async () => new ArrayBuffer(file.size),
      }
    : null;
  const body = {
    get: (name: string) => (name === "audio" || name === "file" || name === "audioFile" ? input : name === "language" ? language ?? null : null),
  };
  return { formData: vi.fn(async () => body) } as unknown as Request;
}

function context() {
  return { params: Promise.resolve({ id: "application-id" }) };
}

describe("POST /api/applications/[id]/form-assistant/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    getUserFromSupabaseSession.mockResolvedValue({ userId: "profile-id", email: "applicant@example.com" });
    createAdminClient.mockReturnValue({ from: vi.fn(() => query({ data: application, error: null })) });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("rejects an unauthenticated request before loading the application", async () => {
    getUserFromSupabaseSession.mockResolvedValue(null);

    const response = await POST(requestWithFile(new File(["hello"], "voice.webm", { type: "audio/webm" })) as never, context());

    expect(response.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an application the signed-in applicant does not own", async () => {
    createAdminClient.mockReturnValue({ from: vi.fn(() => query({ data: null, error: null })) });

    const response = await POST(requestWithFile(new File(["hello"], "voice.webm", { type: "audio/webm" })) as never, context());

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects unsupported audio formats", async () => {
    const response = await POST(requestWithFile(new File(["not audio"], "document.pdf", { type: "application/pdf" })) as never, context());

    expect(response.status).toBe(415);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects recordings larger than 10 MB", async () => {
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "voice.webm", { type: "audio/webm" });

    const response = await POST(requestWithFile(oversized) as never, context());

    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the recording to OpenAI and returns an editable transcript", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ text: "  My name is Chen  ", language: "en", duration: 1.234 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await POST(
      requestWithFile(new File(["hello"], "voice.webm", { type: "audio/webm" }), "en-US") as never,
      context(),
    );
    const payload = await response.json();
    const requestInit = fetchMock.mock.calls[0]?.[1];
    const outgoing = requestInit?.body as FormData;

    expect(response.status).toBe(200);
    expect(payload).toEqual({ transcript: "My name is Chen", detectedLanguage: "en", durationMs: 1234 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
      }),
    );
    expect(outgoing.get("model")).toBe("gpt-4o-mini-transcribe");
    expect(outgoing.get("language")).toBe("en");
    expect((outgoing.get("file") as File).type).toBe("audio/webm");
  });

  it("accepts the codec-qualified WebM MIME emitted by MediaRecorder", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ text: "mixed 中文 and English" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await POST(
      requestWithFile(new File(["hello"], "voice.webm", { type: "audio/webm;codecs=opus" }), "zh-CN") as never,
      context(),
    );

    expect(response.status).toBe(200);
    const outgoing = vi.mocked(fetch).mock.calls[0]?.[1]?.body as FormData;
    expect((outgoing.get("file") as File).type).toBe("audio/webm");
    expect(outgoing.get("language")).toBe("zh");
  });

  it("returns a provider error without exposing the provider response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("sensitive provider details", { status: 500 }));

    const response = await POST(requestWithFile(new File(["hello"], "voice.webm", { type: "audio/webm" })) as never, context());
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({ error: "Voice transcription failed." });
    expect(JSON.stringify(payload)).not.toContain("sensitive provider details");
  });
});

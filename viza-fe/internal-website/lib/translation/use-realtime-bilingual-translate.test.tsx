import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRealtimeBilingualTranslateCache,
  useRealtimeBilingualTranslate,
} from "./use-realtime-bilingual-translate";

const baseProps = {
  sourceValue: "软件工程师",
  targetValue: "",
  sourceLang: "zh",
  targetLang: "en",
  fieldId: "occupation",
  context: "universal_profile",
  fieldType: "text",
  enabled: true,
  targetWasManuallyEdited: false,
  debounceMs: 400,
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function advanceAndFlush(ms = 0) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useRealtimeBilingualTranslate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearRealtimeBilingualTranslateCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces source changes before calling /api/translate", async () => {
    const onTranslatedText = vi.fn();
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      translatedText: "Software engineer",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useRealtimeBilingualTranslate({ ...baseProps, onTranslatedText }),
    );

    expect(result.current.status).toBe("typing");
    expect(fetchMock).not.toHaveBeenCalled();

    await advanceAndFlush(399);
    expect(fetchMock).not.toHaveBeenCalled();

    await advanceAndFlush(1);

    expect(result.current.status).toBe("translated");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/translate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          text: "软件工程师",
          source: "zh",
          target: "en",
          fieldId: "occupation",
          context: "universal_profile",
          fieldType: "text",
        }),
      }),
    );
    expect(onTranslatedText).toHaveBeenCalledWith(
      "Software engineer",
      { force: false, sourceText: "软件工程师" },
    );
  });

  it("keeps only the latest quick input result", async () => {
    const onTranslatedText = vi.fn();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit | undefined) => {
      const body = JSON.parse(String(init?.body)) as { text: string };
      return jsonResponse({
        ok: true,
        translatedText: body.text === "北京" ? "Beijing" : "Chaoyang District, Beijing",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderHook(
      ({ sourceValue }) =>
        useRealtimeBilingualTranslate({ ...baseProps, sourceValue, onTranslatedText }),
      { initialProps: { sourceValue: "北京" } },
    );

    rerender({ sourceValue: "北京市朝阳区" });
    await advanceAndFlush(400);

    expect(onTranslatedText).toHaveBeenCalledWith(
      "Chaoyang District, Beijing",
      { force: false, sourceText: "北京市朝阳区" },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onTranslatedText).not.toHaveBeenCalledWith(
      "Beijing",
      expect.objectContaining({ sourceText: "北京" }),
    );
  });

  it("aborts an in-flight request when the source changes", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn((_url: string, init: RequestInit | undefined) => {
      if (init?.signal instanceof AbortSignal) signals.push(init.signal);
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderHook(
      ({ sourceValue }) =>
        useRealtimeBilingualTranslate({ ...baseProps, sourceValue }),
      { initialProps: { sourceValue: "北京" } },
    );

    await advanceAndFlush(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(false);

    rerender({ sourceValue: "北京市朝阳区" });
    expect(signals[0]?.aborted).toBe(true);
  });

  it("does not overwrite a manually edited target until retry is clicked", async () => {
    const onTranslatedText = vi.fn();
    const onManualEditReset = vi.fn();
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      translatedText: "Software engineer",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useRealtimeBilingualTranslate({
        ...baseProps,
        targetValue: "Backend software engineer",
        targetWasManuallyEdited: true,
        onTranslatedText,
        onManualEditReset,
      }),
    );

    expect(result.current.status).toBe("user_edited");
    await advanceAndFlush(400);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      result.current.retry();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe("translated");
    expect(onManualEditReset).toHaveBeenCalledTimes(1);
    expect(onTranslatedText).toHaveBeenCalledWith(
      "Software engineer",
      { force: true, sourceText: "软件工程师" },
    );
  });

  it("does not request on initial mount when the target already has a value", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useRealtimeBilingualTranslate({
        ...baseProps,
        targetValue: "Software engineer",
      }),
    );

    expect(result.current.status).toBe("translated");
    await advanceAndFlush(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps user content on failure and exposes failed status", async () => {
    const onTranslatedText = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(
      { ok: false, error: "Translation unavailable" },
      { status: 502 },
    )));

    const { result, rerender } = renderHook(
      ({ sourceValue }) =>
        useRealtimeBilingualTranslate({
          ...baseProps,
          sourceValue,
          targetValue: "Existing content",
          onTranslatedText,
        }),
      { initialProps: { sourceValue: "" } },
    );

    rerender({ sourceValue: "软件工程师" });

    await advanceAndFlush(400);

    expect(result.current.status).toBe("failed");
    expect(result.current.error).toBe("Translation unavailable");
    expect(onTranslatedText).not.toHaveBeenCalled();
  });

  it("skips non-translatable field types without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useRealtimeBilingualTranslate({
        ...baseProps,
        fieldId: "passport_number",
        fieldType: "text",
        sourceValue: "E12345678",
      }),
    );

    expect(result.current.status).toBe("skipped");
    await advanceAndFlush(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

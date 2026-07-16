"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shouldSkipTranslation } from "./translation-field-rules";

export type RealtimeTranslationStatus =
  | "idle"
  | "typing"
  | "translating"
  | "translated"
  | "failed"
  | "skipped"
  | "user_edited";

interface TranslateResponse {
  ok?: boolean;
  skipped?: boolean;
  translatedText?: unknown;
  error?: unknown;
}

interface UseRealtimeBilingualTranslateOptions {
  sourceValue: string;
  targetValue: string;
  sourceLang: string;
  targetLang: string;
  fieldId: string;
  context: string;
  enabled?: boolean;
  fieldType?: string | null;
  targetWasManuallyEdited?: boolean;
  debounceMs?: number;
  onTranslatedText?: (translatedText: string, options: { force: boolean; sourceText: string }) => void;
  onClearAutoTranslation?: () => void;
  onManualEditReset?: () => void;
}

interface RunOptions {
  force: boolean;
}

const DEFAULT_DEBOUNCE_MS = 400;
const translationCache = new Map<string, string>();

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function hasChineseText(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function cacheKeyFor(options: {
  sourceLang: string;
  targetLang: string;
  fieldId: string;
  context: string;
  fieldType?: string | null;
  text: string;
}) {
  return [
    clean(options.sourceLang).toLowerCase(),
    clean(options.targetLang).toLowerCase(),
    clean(options.fieldId).toLowerCase(),
    clean(options.context).toLowerCase(),
    clean(options.fieldType).toLowerCase(),
    clean(options.text),
  ].join("\u001f");
}

export function clearRealtimeBilingualTranslateCache() {
  translationCache.clear();
}

export function useRealtimeBilingualTranslate({
  sourceValue,
  targetValue,
  sourceLang,
  targetLang,
  fieldId,
  context,
  enabled = true,
  fieldType = "text",
  targetWasManuallyEdited = false,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onTranslatedText,
  onClearAutoTranslation,
  onManualEditReset,
}: UseRealtimeBilingualTranslateOptions) {
  const [translatedText, setTranslatedText] = useState("");
  const [status, setStatus] = useState<RealtimeTranslationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastRequestedKeyRef = useRef("");
  const activeSourceKeyRef = useRef("");
  const didRunInitialEffectRef = useRef(false);
  const latestOptionsRef = useRef({
    sourceValue,
    targetValue,
    sourceLang,
    targetLang,
    fieldId,
    context,
    enabled,
    fieldType,
    targetWasManuallyEdited,
    debounceMs,
    onTranslatedText,
    onClearAutoTranslation,
    onManualEditReset,
  });

  latestOptionsRef.current = {
    sourceValue,
    targetValue,
    sourceLang,
    targetLang,
    fieldId,
    context,
    enabled,
    fieldType,
    targetWasManuallyEdited,
    debounceMs,
    onTranslatedText,
    onClearAutoTranslation,
    onManualEditReset,
  };

  const normalized = useMemo(() => {
    const text = clean(sourceValue);
    const key = cacheKeyFor({
      sourceLang,
      targetLang,
      fieldId,
      context,
      fieldType,
      text,
    });
    return { text, key };
  }, [context, fieldId, fieldType, sourceLang, sourceValue, targetLang]);

  const abortCurrentRequest = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const runTranslation = useCallback(async ({ force }: RunOptions) => {
    const latest = latestOptionsRef.current;
    const text = clean(latest.sourceValue);
    const key = cacheKeyFor({
      sourceLang: latest.sourceLang,
      targetLang: latest.targetLang,
      fieldId: latest.fieldId,
      context: latest.context,
      fieldType: latest.fieldType,
      text,
    });

    if (!latest.enabled) {
      setStatus("idle");
      return;
    }

    if (!text) {
      abortCurrentRequest();
      lastRequestedKeyRef.current = "";
      setTranslatedText("");
      setError(null);
      setStatus("idle");
      if (!latest.targetWasManuallyEdited) {
        latest.onClearAutoTranslation?.();
      }
      return;
    }

    if (shouldSkipTranslation(latest.fieldId, text, latest.fieldType)) {
      abortCurrentRequest();
      setError(null);
      setStatus("skipped");
      return;
    }

    if (latest.targetWasManuallyEdited && !force) {
      abortCurrentRequest();
      setError(null);
      setStatus("user_edited");
      return;
    }

    const cached = translationCache.get(key);
    if (cached) {
      setTranslatedText(cached);
      setError(null);
      setStatus("translated");
      latest.onTranslatedText?.(cached, { force, sourceText: text });
      lastRequestedKeyRef.current = key;
      return;
    }

    if (!force && lastRequestedKeyRef.current === key) {
      return;
    }
    lastRequestedKeyRef.current = key;

    abortCurrentRequest();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setStatus("translating");
    setError(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          source: latest.sourceLang,
          target: latest.targetLang,
          fieldId: latest.fieldId,
          context: latest.context,
          fieldType: latest.fieldType ?? "text",
        }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as TranslateResponse | null;

      if (controller.signal.aborted || requestId !== requestIdRef.current) return;

      if (!response.ok || !payload?.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Translation failed");
      }

      if (payload.skipped) {
        setStatus("skipped");
        return;
      }

      const nextTranslatedText = typeof payload.translatedText === "string" ? payload.translatedText.trim() : "";
      if (!nextTranslatedText) {
        throw new Error("Translation returned empty text");
      }

      translationCache.set(key, nextTranslatedText);
      setTranslatedText(nextTranslatedText);
      setError(null);
      setStatus("translated");
      latest.onTranslatedText?.(nextTranslatedText, { force, sourceText: text });
    } catch (caught) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      const nextError = caught instanceof Error ? caught.message : "Translation failed";
      setError(nextError);
      setStatus("failed");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [abortCurrentRequest]);

  useEffect(() => {
    const isInitialEffect = !didRunInitialEffectRef.current;
    didRunInitialEffectRef.current = true;

    if (!enabled) {
      abortCurrentRequest();
      setStatus("idle");
      return;
    }

    if (!normalized.text) {
      abortCurrentRequest();
      activeSourceKeyRef.current = "";
      lastRequestedKeyRef.current = "";
      setTranslatedText("");
      setError(null);
      setStatus("idle");
      if (!targetWasManuallyEdited) {
        onClearAutoTranslation?.();
      }
      return;
    }

    if (shouldSkipTranslation(fieldId, normalized.text, fieldType)) {
      abortCurrentRequest();
      activeSourceKeyRef.current = normalized.key;
      setError(null);
      setStatus("skipped");
      return;
    }

    if (targetWasManuallyEdited) {
      abortCurrentRequest();
      activeSourceKeyRef.current = normalized.key;
      setError(null);
      setStatus("user_edited");
      return;
    }

    // A saved target that still contains Chinese is not a translation. This
    // happens in legacy application data when an `_en` answer was populated
    // from the Chinese side, so it must go through the normal translator.
    if (isInitialEffect && targetValue.trim() && !hasChineseText(targetValue)) {
      abortCurrentRequest();
      activeSourceKeyRef.current = normalized.key;
      lastRequestedKeyRef.current = normalized.key;
      setTranslatedText(targetValue.trim());
      setError(null);
      setStatus("translated");
      return;
    }

    if (lastRequestedKeyRef.current === normalized.key && targetValue.trim() && !hasChineseText(targetValue)) {
      abortCurrentRequest();
      activeSourceKeyRef.current = normalized.key;
      setTranslatedText(targetValue.trim());
      setError(null);
      setStatus("translated");
      return;
    }

    if (activeSourceKeyRef.current !== normalized.key) {
      abortCurrentRequest();
      activeSourceKeyRef.current = normalized.key;
    }

    setStatus((current) => current === "translating" ? current : "typing");
    setError(null);

    const timeoutId = window.setTimeout(() => {
      void runTranslation({ force: false });
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    abortCurrentRequest,
    debounceMs,
    enabled,
    fieldId,
    fieldType,
    normalized.key,
    normalized.text,
    onClearAutoTranslation,
    runTranslation,
    targetValue,
    targetWasManuallyEdited,
  ]);

  useEffect(() => () => abortCurrentRequest(), [abortCurrentRequest]);

  const retry = useCallback(() => {
    onManualEditReset?.();
    void runTranslation({ force: true });
  }, [onManualEditReset, runTranslation]);

  const resetManualEdit = useCallback(() => {
    onManualEditReset?.();
  }, [onManualEditReset]);

  return {
    translatedText,
    status,
    error,
    retry,
    resetManualEdit,
    isTranslating: status === "translating",
  };
}

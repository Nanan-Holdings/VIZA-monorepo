"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionEvent = Event & {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type RecognitionErrorEvent = Event & { error: string };

type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => RecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

export type BrowserSpeechLanguage = "zh-CN" | "en-US";
export type BrowserSpeechStatus = "idle" | "listening" | "stopping" | "error" | "unsupported";
export type BrowserSpeechError =
  | "unsupported"
  | "permission_denied"
  | "no_speech"
  | "audio_capture"
  | "network"
  | "aborted"
  | "unknown";

export function normalizeSpeechLanguage(language: string): BrowserSpeechLanguage {
  return language.toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}

export function classifySpeechError(error: string): BrowserSpeechError {
  if (error === "not-allowed" || error === "service-not-allowed") return "permission_denied";
  if (error === "no-speech") return "no_speech";
  if (error === "audio-capture") return "audio_capture";
  if (error === "network") return "network";
  if (error === "aborted") return "aborted";
  return "unknown";
}

export function isRecoverableSpeechError(error: BrowserSpeechError): boolean {
  return error !== "unsupported";
}

export function nextSpeechStatusAfterEnd(status: BrowserSpeechStatus): BrowserSpeechStatus {
  return status === "unsupported" ? "unsupported" : "idle";
}

export function useBrowserSpeech(onTranscript: (value: string) => void, language: string) {
  const [status, setStatus] = useState<BrowserSpeechStatus>("idle");
  const [error, setError] = useState<BrowserSpeechError | null>(null);
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const finalTextRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  const runIdRef = useRef(0);
  const statusRef = useRef<BrowserSpeechStatus>("idle");

  const setSpeechStatus = useCallback((next: BrowserSpeechStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setSpeechStatus("idle");
      return;
    }

    setSpeechStatus("stopping");
    try {
      recognition.stop();
    } catch {
      recognitionRef.current = null;
      setSpeechStatus("idle");
    }
  }, [setSpeechStatus]);

  const start = useCallback((initialValue = "") => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("unsupported");
      setSpeechStatus("unsupported");
      return false;
    }

    runIdRef.current += 1;
    const runId = runIdRef.current;
    recognitionRef.current?.abort();
    const recognition = new Recognition();
    finalTextRef.current = initialValue.trim();
    setError(null);
    setSpeechStatus("listening");
    recognition.lang = normalizeSpeechLanguage(language);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      if (runId !== runIdRef.current) return;
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalTextRef.current = `${finalTextRef.current} ${text}`.trim();
        else interim += text;
      }
      onTranscriptRef.current(`${finalTextRef.current} ${interim}`.trim());
    };
    recognition.onerror = (event) => {
      if (runId !== runIdRef.current) return;
      const nextError = classifySpeechError(event.error);
      setError(nextError);
      setSpeechStatus("error");
    };
    recognition.onend = () => {
      if (runId !== runIdRef.current) return;
      recognitionRef.current = null;
      setSpeechStatus(nextSpeechStatusAfterEnd(statusRef.current));
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setError("unknown");
      setSpeechStatus("error");
      return false;
    }

    recognitionRef.current = recognition;
    return true;
  }, [language, setSpeechStatus]);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition || statusRef.current !== "listening") return;
    recognition.lang = normalizeSpeechLanguage(language);
  }, [language]);

  useEffect(() => () => {
    runIdRef.current += 1;
    recognitionRef.current?.abort();
  }, []);

  const supported = typeof window !== "undefined" && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  return {
    isListening: status === "listening",
    error,
    errorRecoverable: error ? isRecoverableSpeechError(error) : false,
    status,
    supported,
    language: normalizeSpeechLanguage(language),
    start,
    stop,
  };
}

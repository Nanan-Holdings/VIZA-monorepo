"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrowserSpeechLanguage } from "./use-browser-speech";
import { normalizeSpeechLanguage } from "./use-browser-speech";

export type SpeechVoiceLike = Pick<
  SpeechSynthesisVoice,
  "default" | "lang" | "localService" | "name" | "voiceURI"
>;

type SpeechSynthesisLike = Pick<
  SpeechSynthesis,
  "addEventListener" | "cancel" | "getVoices" | "removeEventListener" | "speak"
>;

type UtteranceLike = Pick<
  SpeechSynthesisUtterance,
  "lang" | "pitch" | "rate" | "text" | "voice" | "volume"
>;

const QUALITY_NAME_PATTERN = /natural|neural|enhanced|premium|online|studio|high.?quality/i;
const LOW_QUALITY_NAME_PATTERN = /compact|espeak|festival|basic/i;
const MANDARIN_NAME_PATTERN = /mandarin|普通话|普通話|国语|國語|中文/i;

function normalizedLocale(value: string) {
  return value.trim().replace(/_/g, "-").toLowerCase();
}

export function scoreInterviewerVoice(
  voice: SpeechVoiceLike,
  language: BrowserSpeechLanguage,
): number {
  const voiceLocale = normalizedLocale(voice.lang);
  const targetLocale = normalizedLocale(language);
  const targetFamily = targetLocale.split("-")[0];
  const voiceFamily = voiceLocale.split("-")[0];
  const isMandarin = language === "zh-CN" && (
    voiceFamily === "zh"
    || voiceLocale.startsWith("cmn")
    || MANDARIN_NAME_PATTERN.test(voice.name)
  );
  const languageMatches = voiceLocale === targetLocale
    || voiceFamily === targetFamily
    || isMandarin;
  if (!languageMatches) return Number.NEGATIVE_INFINITY;

  let score = voiceLocale === targetLocale ? 140 : 70;
  if (language === "zh-CN" && /^(zh-cn|zh-hans|cmn(?:-hans)?-cn|cmn-cn)/i.test(voiceLocale)) score += 30;
  if (language === "zh-CN" && MANDARIN_NAME_PATTERN.test(voice.name)) score += 18;
  if (language === "en-US" && voiceLocale.startsWith("en-us")) score += 30;
  if (QUALITY_NAME_PATTERN.test(voice.name)) score += 32;
  if (!voice.localService) score += 8;
  if (voice.default) score += 4;
  if (LOW_QUALITY_NAME_PATTERN.test(voice.name)) score -= 35;
  return score;
}

export function selectInterviewerVoice(
  voices: SpeechVoiceLike[],
  language: BrowserSpeechLanguage,
): SpeechVoiceLike | null {
  return voices
    .map((voice, index) => ({ voice, index, score: scoreInterviewerVoice(voice, language) }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.voice ?? null;
}

export function interviewerSpeechTuning(language: BrowserSpeechLanguage) {
  return language === "zh-CN"
    ? { rate: 0.92, pitch: 1, volume: 1 }
    : { rate: 0.96, pitch: 1, volume: 1 };
}

export function cleanInterviewerSpeechText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^\s*(?:[-+*•▪◦]|\d+[.)、])\s+/gm, "")
    .replace(/[*_~`#>|]+/g, " ")
    .replace(/\s*\n+\s*/g, "。")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([，。！？；：,.!?;:])/g, "$1")
    .replace(/([。！？!?])\1+/g, "$1")
    .trim();
}

export function playInterviewerSpeech(input: {
  synthesis: SpeechSynthesisLike;
  createUtterance: (text: string) => UtteranceLike;
  text: string;
  language: BrowserSpeechLanguage;
  voices?: SpeechVoiceLike[];
}) {
  const text = cleanInterviewerSpeechText(input.text);
  if (!text) return null;
  const voice = selectInterviewerVoice(input.voices ?? input.synthesis.getVoices(), input.language);
  const tuning = interviewerSpeechTuning(input.language);
  input.synthesis.cancel();
  const utterance = input.createUtterance(text);
  utterance.lang = input.language;
  utterance.rate = tuning.rate;
  utterance.pitch = tuning.pitch;
  utterance.volume = tuning.volume;
  if (voice) utterance.voice = voice as SpeechSynthesisVoice;
  input.synthesis.speak(utterance as SpeechSynthesisUtterance);
  return voice?.name ?? null;
}

export function useInterviewerTts(language: string) {
  const normalizedLanguage = normalizeSpeechLanguage(language);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const pendingRef = useRef<{ text: string; language: BrowserSpeechLanguage } | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    pendingRef.current = null;
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  const speakNow = useCallback((text: string, nextLanguage: BrowserSpeechLanguage, voices: SpeechSynthesisVoice[]) => {
    if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return false;
    const voiceName = playInterviewerSpeech({
      synthesis: window.speechSynthesis,
      createUtterance: (value) => new SpeechSynthesisUtterance(value),
      text,
      language: nextLanguage,
      voices,
    });
    setSelectedVoiceName(voiceName);
    return true;
  }, []);

  const stop = useCallback(() => {
    clearPending();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, [clearPending]);

  const play = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return false;
    stop();
    const voices = window.speechSynthesis.getVoices();
    voicesRef.current = voices;
    if (voices.length > 0) return speakNow(text, normalizedLanguage, voices);

    pendingRef.current = { text, language: normalizedLanguage };
    fallbackTimerRef.current = setTimeout(() => {
      const pending = pendingRef.current;
      clearPending();
      if (pending) speakNow(pending.text, pending.language, []);
    }, 350);
    return true;
  }, [clearPending, normalizedLanguage, speakNow, stop]);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const synthesis = window.speechSynthesis;
    const refreshVoices = () => {
      const voices = synthesis.getVoices();
      voicesRef.current = voices;
      const pending = pendingRef.current;
      if (!pending || voices.length === 0) return;
      clearPending();
      speakNow(pending.text, pending.language, voices);
    };
    refreshVoices();
    synthesis.addEventListener("voiceschanged", refreshVoices);
    return () => synthesis.removeEventListener("voiceschanged", refreshVoices);
  }, [clearPending, speakNow]);

  useEffect(() => {
    stop();
    const voice = selectInterviewerVoice(voicesRef.current, normalizedLanguage);
    setSelectedVoiceName(voice?.name ?? null);
  }, [normalizedLanguage, stop]);

  useEffect(() => stop, [stop]);

  return {
    play,
    stop,
    selectedVoiceName,
    supported: typeof window !== "undefined"
      && Boolean(window.speechSynthesis)
      && typeof SpeechSynthesisUtterance !== "undefined",
  };
}

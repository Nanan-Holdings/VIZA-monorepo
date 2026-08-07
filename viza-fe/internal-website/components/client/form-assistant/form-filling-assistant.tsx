"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AlertCircle, CheckCircle2, Mic, Send, Sparkles, Square, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface FormAssistantMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt?: string;
}

export interface FormAssistantMissingField {
  fieldName: string;
  label: string;
  required?: boolean;
  section?: string;
}

export interface FormAssistantValidationIssue {
  id?: string;
  fieldName?: string;
  message: string;
}

export interface FormAssistantValidationResult {
  errors: FormAssistantValidationIssue[];
  warnings: FormAssistantValidationIssue[];
  warningsAcknowledged?: boolean;
}

export type FormAssistantTranscription =
  | string
  | {
      transcript: string;
      detectedLanguage?: string;
      durationMs?: number;
    };

export interface FormFillingAssistantProps {
  applicationId: string;
  locale: string;
  isZh?: boolean;
  progress: { completed: number; total: number };
  messages: FormAssistantMessage[];
  missingFields: FormAssistantMissingField[];
  aiFilledFieldNames: string[];
  loading?: boolean;
  validationResult?: FormAssistantValidationResult | null;
  onSend: (text: string) => void | Promise<void>;
  onTranscribe: (file: File) => FormAssistantTranscription | Promise<FormAssistantTranscription>;
  onValidate: () => void | Promise<void>;
  onAcknowledgeWarnings: () => void | Promise<void>;
  onGoToField: (fieldName: string) => void;
  onGoToReview: () => void;
  className?: string;
}

const MAX_RECORDING_MS = 60_000;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

type RecordingState = "idle" | "recording" | "transcribing";

function getMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  if (typeof MediaRecorder.isTypeSupported !== "function") return "";

  return MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function getExtension(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function isTranscriptionResult(value: FormAssistantTranscription): value is Exclude<FormAssistantTranscription, string> {
  return typeof value !== "string";
}

export function FormFillingAssistant({
  applicationId,
  locale,
  isZh,
  progress,
  messages,
  missingFields,
  aiFilledFieldNames,
  loading = false,
  validationResult = null,
  onSend,
  onTranscribe,
  onValidate,
  onAcknowledgeWarnings,
  onGoToField,
  onGoToReview,
  className,
}: FormFillingAssistantProps) {
  const t = useTranslations("application.formAssistant");
  const idPrefix = useId().replace(/:/g, "-");
  const titleId = `form-assistant-${idPrefix}-title`;
  const missingTitleId = `form-assistant-${idPrefix}-missing-title`;
  const filledTitleId = `form-assistant-${idPrefix}-filled-title`;
  const validationTitleId = `form-assistant-${idPrefix}-validation-title`;
  const composerStorageKey = `viza:form-assistant:composer:${applicationId}`;
  const [draft, setDraft] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(`viza:form-assistant:composer:${applicationId}`) ?? "";
  });
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const cancelRequestedRef = useRef(false);
  const mountedRef = useRef(true);
  const resolvedIsZh = isZh ?? locale.toLowerCase().startsWith("zh");

  const clearRecordingTimers = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const resetRecordingUi = useCallback(() => {
    clearRecordingTimers();
    recorderRef.current = null;
    chunksRef.current = [];
    setRecordingState("idle");
    setRecordingSeconds(0);
  }, [clearRecordingTimers]);

  const transcribeRecordedAudio = useCallback(
    async (chunks: Blob[], mimeType: string) => {
      if (cancelRequestedRef.current || !mountedRef.current) return;

      const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
      if (blob.size === 0) {
        setRecordingError(t("errors.emptyRecording"));
        resetRecordingUi();
        return;
      }
      if (blob.size > MAX_AUDIO_BYTES) {
        setRecordingError(t("errors.fileTooLarge"));
        resetRecordingUi();
        return;
      }

      setRecordingState("transcribing");
      try {
        const file = new File([blob], `form-assistant-recording.${getExtension(mimeType)}`, {
          type: blob.type,
        });
        const result = await onTranscribe(file);
        if (!mountedRef.current || cancelRequestedRef.current) return;

        const transcript = isTranscriptionResult(result) ? result.transcript : result;
        if (transcript.trim()) {
          setDraft((current) => (current.trim() ? `${current.trim()}\n${transcript.trim()}` : transcript.trim()));
          setRecordingError(null);
        } else {
          setRecordingError(t("errors.emptyTranscript"));
        }
      } catch {
        if (mountedRef.current) setRecordingError(t("errors.transcriptionFailed"));
      } finally {
        if (mountedRef.current) resetRecordingUi();
      }
    },
    [onTranscribe, resetRecordingUi, t],
  );

  const stopRecording = useCallback(
    (cancelled = false) => {
      cancelRequestedRef.current = cancelled;
      clearRecordingTimers();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
        return;
      }
      stopTracks();
      resetRecordingUi();
    },
    [clearRecordingTimers, resetRecordingUi, stopTracks],
  );

  const startRecording = useCallback(async () => {
    if (loading || recordingState !== "idle") return;
    setRecordingError(null);
    cancelRequestedRef.current = false;

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecordingError(t("errors.unsupported"));
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      const errorName = cause instanceof Error ? cause.name : "";
      setRecordingError(t(errorName === "NotFoundError" ? "errors.noDevice" : "errors.permissionDenied"));
      return;
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const mimeType = getMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setRecordingError(t("errors.unsupported"));
      return;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      cancelRequestedRef.current = true;
      if (mountedRef.current) setRecordingError(t("errors.recordingFailed"));
      stopTracks();
      resetRecordingUi();
    };
    recorder.onstop = () => {
      const chunks = chunksRef.current;
      chunksRef.current = [];
      const actualMimeType = recorder.mimeType || mimeType || "audio/webm";
      stopTracks();
      if (cancelRequestedRef.current) {
        if (mountedRef.current) resetRecordingUi();
        return;
      }
      void transcribeRecordedAudio(chunks, actualMimeType);
    };

    try {
      recorder.start();
    } catch {
      stopTracks();
      resetRecordingUi();
      setRecordingError(t("errors.recordingFailed"));
      return;
    }

    setRecordingState("recording");
    setRecordingSeconds(0);
    intervalRef.current = window.setInterval(() => {
      setRecordingSeconds((current) => Math.min(current + 1, MAX_RECORDING_MS / 1000));
    }, 1000);
    timeoutRef.current = window.setTimeout(() => stopRecording(), MAX_RECORDING_MS);
  }, [loading, recordingState, resetRecordingUi, stopRecording, stopTracks, t, transcribeRecordedAudio]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRequestedRef.current = true;
      clearRecordingTimers();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stopTracks();
      recorderRef.current = null;
    };
  }, [clearRecordingTimers, stopTracks]);

  useEffect(() => {
    if (draft.trim()) {
      window.localStorage.setItem(composerStorageKey, draft);
    } else {
      window.localStorage.removeItem(composerStorageKey);
    }
  }, [composerStorageKey, draft]);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || loading || recordingState !== "idle") return;
    setDraft("");
    const result = onSend(trimmed);
    void Promise.resolve(result).catch(() => {
      if (!mountedRef.current) return;
      setDraft((current) => current.trim() ? current : trimmed);
      setRecordingError(t("errors.sendFailed"));
    });
  }, [draft, loading, onSend, recordingState, t]);

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
      if (event.key === "Escape" && draft) {
        event.preventDefault();
        setDraft("");
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [draft, handleSend],
  );

  const completed = Math.max(0, Math.min(progress.completed, progress.total));
  const progressPercent = progress.total > 0 ? Math.round((completed / progress.total) * 100) : 0;
  const errors = validationResult?.errors ?? [];
  const warnings = validationResult?.warnings ?? [];
  const canGoToReview = Boolean(
    validationResult && errors.length === 0 && (warnings.length === 0 || validationResult.warningsAcknowledged),
  );

  return (
    <Card
      className={cn("w-full border-brand-100 bg-white shadow-sm", className)}
      data-application-id={applicationId}
      data-locale={locale}
      data-is-zh={resolvedIsZh ? "true" : "false"}
      lang={locale}
      role="region"
      aria-labelledby={titleId}
    >
      <CardHeader className="gap-4 border-b border-brand-50 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500" aria-hidden="true">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <CardTitle id={titleId} className="text-lg text-brand-600">
                {t("title")}
              </CardTitle>
              <CardDescription className="mt-2 leading-6">{t("description")}</CardDescription>
            </div>
          </div>
          <Badge className="bg-brand-50 text-brand-600 hover:bg-brand-50" variant="secondary">
            {t("badge")}
          </Badge>
        </div>
        <div className="space-y-2" aria-label={t("progressLabel")}>
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{t("progress", { completed, total: progress.total })}</span>
            <span className="font-medium text-brand-600">{progressPercent}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-brand-50"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label={t("progressLabel")}
          >
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label={t("conversationLabel")}>
          {messages.length === 0 ? (
            <p className="rounded-lg bg-brand-50/70 px-4 py-3 text-sm leading-6 text-brand-700">{t("emptyConversation")}</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[90%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-6",
                    message.role === "user" ? "rounded-br-sm bg-brand-500 text-white" : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {message.content}
                </p>
              </div>
            ))
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t("thinking")}
            </p>
          ) : null}
        </div>

        {missingFields.length > 0 ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4" aria-labelledby={missingTitleId}>
            <div className="mb-3 flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-amber-700" aria-hidden="true" />
              <h3 id={missingTitleId} className="text-sm font-semibold text-amber-900">
                {t("missing.title")}
              </h3>
            </div>
            <ul className="space-y-1.5">
              {missingFields.map((field) => (
                <li key={field.fieldName}>
                  <Button
                    className="min-h-11 w-full justify-between px-2 text-left text-sm font-normal text-amber-900 hover:bg-amber-100"
                    variant="ghost"
                    onClick={() => onGoToField(field.fieldName)}
                  >
                    <span>{field.label}</span>
                    <span className="ml-3 shrink-0 text-xs text-amber-700">
                      {field.required === false ? t("missing.optional") : t("missing.required")}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {aiFilledFieldNames.length > 0 ? (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4" aria-labelledby={filledTitleId}>
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 id={filledTitleId} className="text-sm font-semibold text-emerald-900">
                {t("filled.title")}
              </h3>
            </div>
            <ul className="flex flex-wrap gap-2">
              {aiFilledFieldNames.map((fieldName) => (
                <li key={fieldName}>
                  <button
                    type="button"
                    className="min-h-11 rounded-full border border-emerald-300 bg-white px-3 text-left text-sm text-emerald-900 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                    onClick={() => onGoToField(fieldName)}
                  >
                    {fieldName}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {validationResult ? (
          <section className="space-y-3" aria-labelledby={validationTitleId} aria-live="polite">
            <h3 id={validationTitleId} className="text-sm font-semibold text-brand-700">
              {t("validation.title")}
            </h3>
            {errors.length > 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  <p className="text-sm font-semibold">{t("validation.errors", { count: errors.length })}</p>
                </div>
                <ul className="space-y-1">
                  {errors.map((issue, index) => (
                    <li key={issue.id ?? `${issue.fieldName ?? "error"}-${index}`}>
                      {issue.fieldName ? (
                        <Button variant="link" className="h-auto min-h-11 justify-start p-0 text-left text-sm font-normal text-red-800" onClick={() => onGoToField(issue.fieldName ?? "")}>
                          {issue.message}
                        </Button>
                      ) : (
                        <p className="text-sm leading-6 text-red-800">{issue.message}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {warnings.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-amber-900">
                  <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                  <p className="text-sm font-semibold">{t("validation.warnings", { count: warnings.length })}</p>
                </div>
                <ul className="space-y-1">
                  {warnings.map((issue, index) => (
                    <li key={issue.id ?? `${issue.fieldName ?? "warning"}-${index}`}>
                      {issue.fieldName ? (
                        <Button variant="link" className="h-auto min-h-11 justify-start p-0 text-left text-sm font-normal text-amber-900" onClick={() => onGoToField(issue.fieldName ?? "")}>
                          {issue.message}
                        </Button>
                      ) : (
                        <p className="text-sm leading-6 text-amber-900">{issue.message}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {errors.length === 0 && warnings.length === 0 ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">{t("validation.pass")}</p>
            ) : null}
          </section>
        ) : null}

        {recordingError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">
            {recordingError}
          </p>
        ) : null}

        <div className="space-y-3">
          <div className="rounded-xl border border-input bg-white p-3 shadow-xs focus-within:border-brand-500">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={t("composer.placeholder")}
              aria-label={t("composer.label")}
              disabled={loading || recordingState === "transcribing"}
              rows={3}
              className="min-h-20 resize-y border-0 px-1 py-1 text-base shadow-none focus-visible:ring-0"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Button
                  type="button"
                  variant={recordingState === "recording" ? "destructive" : "outline"}
                  size="icon"
                  className="h-11 w-11 rounded-full"
                  aria-label={recordingState === "recording" ? t("composer.stopRecording") : t("composer.startRecording")}
                  aria-pressed={recordingState === "recording"}
                  onClick={() => (recordingState === "recording" ? stopRecording() : void startRecording())}
                  disabled={loading || recordingState === "transcribing"}
                >
                  {recordingState === "recording" ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                {recordingState === "recording" ? <span aria-live="polite">{t("composer.recording", { seconds: recordingSeconds })}</span> : null}
                {recordingState === "transcribing" ? <span aria-live="polite">{t("composer.transcribing")}</span> : null}
                {recordingState === "recording" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 px-2 text-xs text-muted-foreground"
                    onClick={() => stopRecording(true)}
                  >
                    {t("composer.cancelRecording")}
                  </Button>
                ) : null}
              </div>
              <Button
                type="button"
                variant="default"
                size="icon"
                className="h-11 w-11 rounded-full bg-brand-500 text-white hover:bg-brand-600"
                aria-label={t("composer.send")}
                onClick={handleSend}
                disabled={!draft.trim() || loading || recordingState !== "idle"}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{t("composer.hint")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          {canGoToReview ? (
            <BrandActionButton onClick={onGoToReview} disabled={loading}>
              {t("actions.goToReview")}
            </BrandActionButton>
          ) : warnings.length > 0 && errors.length === 0 && !validationResult?.warningsAcknowledged ? (
            <BrandActionButton onClick={() => void onAcknowledgeWarnings()} loading={loading} loadingText={t("actions.acknowledgingWarnings")}>
              {t("actions.acknowledgeWarnings")}
            </BrandActionButton>
          ) : (
            <BrandActionButton variant="secondary" onClick={() => void onValidate()} loading={loading} loadingText={t("actions.checking")}>
              {validationResult ? t("actions.checkAgain") : t("actions.checkAnswers")}
            </BrandActionButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

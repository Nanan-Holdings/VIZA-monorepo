"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowUp, Robot as Bot, CheckCircle as CheckCircle2, Microphone as Mic, Square, Warning as TriangleAlert } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { ChatMessage } from "@/components/client/companion/chat-message";
import { ScrollToBottomFab } from "@/components/client/companion/scroll-to-bottom-fab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FORM_ASSISTANT_PROVIDERS_UNAVAILABLE_CODE } from "@/types/form-assistant";

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
  severity?: "error" | "warning";
}

export interface FormAssistantValidationResult {
  errors: FormAssistantValidationIssue[];
  warnings: FormAssistantValidationIssue[];
  warningsAcknowledged?: boolean;
  dirty?: boolean;
}

export type FormAssistantTranscription =
  | string
  | {
      transcript: string;
      detectedLanguage?: string;
      durationMs?: number;
    };

export interface FormAssistantFillNoticeItem {
  fieldName: string;
  label: string;
  value: string;
  displayValue: string;
}

export interface FormAssistantFillNotice {
  id: string;
  items: FormAssistantFillNoticeItem[];
}

export interface FormFillingAssistantProps {
  applicationId: string;
  locale: string;
  isZh?: boolean;
  progress: { completed: number; total: number };
  messages: FormAssistantMessage[];
  missingFields: FormAssistantMissingField[];
  fillNotice?: FormAssistantFillNotice | null;
  loading?: boolean;
  validationResult?: FormAssistantValidationResult | null;
  showReviewAction?: boolean;
  onSend: (text: string) => void | Promise<void>;
  onTranscribe: (file: File) => FormAssistantTranscription | Promise<FormAssistantTranscription>;
  onAcknowledgeWarnings: () => void | Promise<void>;
  onUndoFill: (items: FormAssistantFillNoticeItem[]) => void | Promise<void>;
  onDismissFillNotice: (noticeId: string) => void;
  onValidate: () => unknown | Promise<unknown>;
  onGoToReview: () => void | Promise<void>;
  renderIssueField?: (issue: FormAssistantValidationIssue) => ReactNode;
  onJumpToIssue?: (fieldName: string) => void;
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
  fillNotice = null,
  loading = false,
  validationResult = null,
  showReviewAction,
  onSend,
  onTranscribe,
  onAcknowledgeWarnings,
  onUndoFill,
  onDismissFillNotice,
  onValidate,
  onGoToReview,
  renderIssueField,
  onJumpToIssue,
  className,
}: FormFillingAssistantProps) {
  const t = useTranslations("application.formAssistant");
  const idPrefix = useId().replace(/:/g, "-");
  const titleId = `form-assistant-${idPrefix}-title`;
  const validationTitleId = `form-assistant-${idPrefix}-validation-title`;
  const composerStorageKey = `viza:form-assistant:composer:${applicationId}`;
  const [draft, setDraft] = useState(() => {
    if (typeof window === "undefined" || !window.localStorage) return "";
    return window.localStorage.getItem(`viza:form-assistant:composer:${applicationId}`) ?? "";
  });
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [undoingFill, setUndoingFill] = useState(false);
  const [undoFillError, setUndoFillError] = useState<string | null>(null);
  const [reviewActionPending, setReviewActionPending] = useState(false);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const cancelRequestedRef = useRef(false);
  const mountedRef = useRef(true);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldFollowLatestRef = useRef(true);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
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
    if (!window.localStorage) return;
    if (draft.trim()) {
      window.localStorage.setItem(composerStorageKey, draft);
    } else {
      window.localStorage.removeItem(composerStorageKey);
    }
  }, [composerStorageKey, draft]);

  useEffect(() => {
    setUndoFillError(null);
    if (!fillNotice) return;
    const noticeId = fillNotice.id;
    const timeout = window.setTimeout(() => onDismissFillNotice(noticeId), 30_000);
    return () => window.clearTimeout(timeout);
  }, [fillNotice, onDismissFillNotice]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, 168)}px`;
  }, [draft]);

  const scrollConversationToLatest = useCallback(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    conversation.scrollTop = conversation.scrollHeight;
    shouldFollowLatestRef.current = true;
    setShowScrollToLatest(false);
  }, []);

  const handleConversationScroll = useCallback(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    const distanceFromBottom = conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight;
    const isNearBottom = distanceFromBottom <= 64;
    shouldFollowLatestRef.current = isNearBottom;
    setShowScrollToLatest(!isNearBottom);
  }, []);

  useEffect(() => {
    if (shouldFollowLatestRef.current) scrollConversationToLatest();
  }, [loading, messages, scrollConversationToLatest, validationResult]);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || loading || recordingState !== "idle") return;
    setRecordingError(null);
    setDraft("");
    const result = onSend(trimmed);
    void Promise.resolve(result).catch((error: unknown) => {
      if (!mountedRef.current) return;
      setDraft((current) => current.trim() ? current : trimmed);
      const code = error instanceof Error && "code" in error
        ? (error as Error & { code?: unknown }).code
        : null;
      setRecordingError(t(
        code === FORM_ASSISTANT_PROVIDERS_UNAVAILABLE_CODE
          ? "errors.providersUnavailable"
          : "errors.sendFailed",
      ));
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

  const handleUndoFill = useCallback(async () => {
    if (!fillNotice || undoingFill) return;
    setUndoingFill(true);
    setUndoFillError(null);
    try {
      await onUndoFill(fillNotice.items);
      onDismissFillNotice(fillNotice.id);
    } catch {
      setUndoFillError(t("filledNotice.undoFailed"));
    } finally {
      if (mountedRef.current) setUndoingFill(false);
    }
  }, [fillNotice, onDismissFillNotice, onUndoFill, t, undoingFill]);

  const completed = Math.max(0, Math.min(progress.completed, progress.total));
  const progressPercent = progress.total > 0 ? Math.round((completed / progress.total) * 100) : 0;
  const errors = validationResult?.errors ?? [];
  const warnings = validationResult?.warnings ?? [];
  const validationIsClean = validationResult != null && !validationResult.dirty;
  const warningsAcknowledged = validationResult?.warningsAcknowledged ?? false;
  const canGoToReview = Boolean(
    validationIsClean &&
    errors.length === 0 &&
    (warnings.length === 0 || warningsAcknowledged),
  );
  const handleReviewAction = useCallback(async () => {
    if (reviewActionPending || loading) return;
    setReviewActionPending(true);
    setReviewActionError(null);
    try {
      if (
        validationIsClean &&
        warnings.length > 0 &&
        errors.length === 0 &&
        !warningsAcknowledged
      ) {
        await onAcknowledgeWarnings();
      } else if (canGoToReview) {
        await onGoToReview();
      } else {
        await onValidate();
      }
    } catch {
      if (mountedRef.current) setReviewActionError(t("errors.reviewFailed"));
    } finally {
      if (mountedRef.current) setReviewActionPending(false);
    }
  }, [
    canGoToReview,
    errors.length,
    loading,
    onAcknowledgeWarnings,
    onGoToReview,
    onValidate,
    reviewActionPending,
    t,
    validationIsClean,
    warningsAcknowledged,
    warnings.length,
  ]);

  return (
    <Card
      className={cn("w-full border-brand-100 bg-white shadow-none", className)}
      data-application-id={applicationId}
      data-locale={locale}
      data-is-zh={resolvedIsZh ? "true" : "false"}
      lang={locale}
      role="region"
      aria-labelledby={titleId}
    >
      <CardHeader className="gap-4 border-b border-brand-50 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500" aria-hidden="true">
            <Bot className="h-5 w-5" data-testid="form-assistant-icon" />
          </span>
          <div className="min-w-0">
            <CardTitle id={titleId} className="text-lg text-brand-600">
              {t("title")}
            </CardTitle>
            <CardDescription className="mt-2 leading-6">{t("description")}</CardDescription>
          </div>
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
        <div className="relative mx-auto w-full max-w-[760px]">
          <div
            ref={conversationRef}
            className="max-h-[28rem] min-h-32 space-y-8 overflow-y-auto overscroll-y-contain py-2 pr-2"
            role="log"
            aria-live="polite"
            aria-label={t("conversationLabel")}
            tabIndex={0}
            onScroll={handleConversationScroll}
          >
            {messages.length === 0 ? (
              <ChatMessage role="agent" content={t("emptyConversation")} density="compact" />
            ) : (
              messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role === "user" ? "user" : "agent"}
                  content={message.content}
                  density="compact"
                />
              ))
            )}
            {loading ? (
              <div className="flex gap-1" aria-label={t("thinking")} aria-live="polite">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-2 w-2 animate-bounce rounded-full bg-brand-500"
                    style={{ animationDelay: `${delay}ms` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : null}
            {validationResult ? (
              <section className="space-y-3" aria-labelledby={validationTitleId} aria-live="polite">
                <h3 id={validationTitleId} className="text-sm font-semibold text-brand-700">
                  {t("validation.title")}
                </h3>
                {errors.length > 0 ? (
                  <ClientErrorAlert
                    title={t("validation.errors", { count: errors.length })}
                    message={<ul className="space-y-3">
                      {errors.map((issue, index) => (
                        <li
                          key={issue.id ?? `${issue.fieldName ?? "error"}-${index}`}
                          className="space-y-3 rounded-lg border border-red-200 bg-white p-4"
                          data-form-assistant-review-issue="error"
                        >
                          <p className="text-sm leading-6 text-red-800">{issue.message}</p>
                          {renderIssueField?.(issue)}
                          {issue.fieldName && onJumpToIssue ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-red-300 text-red-800 hover:bg-red-100 hover:text-red-900"
                              onClick={() => onJumpToIssue(issue.fieldName!)}
                            >
                              {t("reviewRepair.jumpToOriginal")}
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>}
                  />
                ) : null}
                {warnings.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-amber-900">
                      <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                      <p className="text-sm font-semibold">{t("validation.warnings", { count: warnings.length })}</p>
                    </div>
                    <ul className="space-y-3">
                      {warnings.map((issue, index) => (
                        <li
                          key={issue.id ?? `${issue.fieldName ?? "warning"}-${index}`}
                          className="space-y-3 rounded-lg border border-amber-200 bg-white p-4"
                          data-form-assistant-review-issue="warning"
                        >
                          <p className="text-sm leading-6 text-amber-900">{issue.message}</p>
                          {renderIssueField?.(issue)}
                          {issue.fieldName && onJumpToIssue ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-amber-300 text-amber-900 hover:bg-amber-100 hover:text-amber-950"
                              onClick={() => onJumpToIssue(issue.fieldName!)}
                            >
                              {t("reviewRepair.jumpToOriginal")}
                            </Button>
                          ) : null}
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
            {reviewActionError ? <ClientErrorAlert message={reviewActionError} /> : null}
            {(showReviewAction ?? (missingFields.length === 0 && progress.total > 0)) && !loading ? (
              <div
                className="flex justify-start pb-1"
                data-testid="form-assistant-review-action"
              >
                {validationResult && !validationResult.dirty && warnings.length > 0 && errors.length === 0 && !validationResult.warningsAcknowledged ? (
                  <BrandActionButton onClick={() => void handleReviewAction()} loading={reviewActionPending} loadingText={t("actions.acknowledgingWarnings")}>
                    {t("actions.acknowledgeWarnings")}
                  </BrandActionButton>
                ) : (
                  <BrandActionButton
                    onClick={() => void handleReviewAction()}
                    loading={reviewActionPending}
                    loadingText={t("actions.checking")}
                  >
                    {canGoToReview
                      ? t("actions.goToFinalReview")
                      : validationResult
                        ? t("actions.checkAgain")
                        : t("actions.checkAnswers")}
                  </BrandActionButton>
                )}
              </div>
            ) : null}
          </div>
          <ScrollToBottomFab
            show={showScrollToLatest}
            onClick={scrollConversationToLatest}
            label={t("scrollToLatest")}
            className="bottom-3 right-3 px-4 py-2"
          />
        </div>

        {fillNotice ? (
          <section
            className="fixed bottom-6 left-1/2 z-[80] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl border border-brand-100 bg-white px-4 py-3 text-brand-700 shadow-lg sm:bottom-8"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="form-assistant-fill-notice"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
                <div className="space-y-1">
                  {fillNotice.items.map((item) => (
                    <p key={item.fieldName} className="text-sm leading-5">
                      {t("filledNotice.message", { label: item.label, value: item.displayValue })}
                    </p>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-3 text-sm font-medium text-brand-600 hover:bg-brand-100 hover:text-brand-700"
                onClick={() => void handleUndoFill()}
                disabled={undoingFill}
              >
                {undoingFill ? t("filledNotice.undoing") : t("filledNotice.undo")}
              </Button>
            </div>
            {undoFillError ? <ClientErrorAlert className="mt-2" message={undoFillError} /> : null}
          </section>
        ) : null}

        {recordingError ? <ClientErrorAlert message={recordingError} /> : null}

        <div className="mx-auto w-full max-w-[760px]">
          <div className="flex items-center gap-2 rounded-[26px] border border-gray-200 bg-white px-3 py-2 shadow-none transition-all duration-200 hover:border-gray-300 focus-within:border-brand-500">
            <Textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={t("composer.placeholder")}
              aria-label={t("composer.label")}
              disabled={recordingState === "transcribing"}
              rows={1}
              className="min-h-11 max-h-[168px] flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-base leading-7 shadow-none outline-none placeholder:text-gray-400 focus-visible:ring-0"
            />
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Button
                  type="button"
                  variant={recordingState === "recording" ? "destructive" : "outline"}
                  size="icon"
                  className="h-11 w-11 rounded-full border-gray-200"
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
                <ArrowUp className="size-5" weight="bold" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

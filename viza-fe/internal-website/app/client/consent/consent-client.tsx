"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
} from "react";
import {
  Warning as AlertTriangle,
  ArrowRight,
  CheckCircle as CheckCircle2,
  Circle,
  Eraser,
  ArrowSquareOut as ExternalLink,
  Signature as FileSignature,
  EnvelopeOpen as MailCheck,
  PencilLine as PenLine,
  ShieldCheck,
} from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import { acceptConsentAndSignature } from "./actions";
import {
  AGENCY_AUTHORISATION_DOCUMENT,
  type ConsentApplication,
  type ConsentDocumentStatus,
  type ConsentHistoryEvent,
  type ConsentProgressCounts,
  type ConsentSubmissionInput,
  type NextConsentStep,
  type SignatureMode,
  type SignatureStatus,
} from "./consent-config";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import {
  BrandActionButton,
  brandActionButtonVariants,
} from "@/components/client/brand-action-button";
import { cn } from "@/lib/utils";
import { isChineseLocale } from "@/lib/i18n/locale";
import {
  getConsentCopy,
  localizeApplicationName,
  localizeConsentDocument,
  localizeNextStep,
  localizeStatus,
} from "./consent-copy";
import type { ConsentCopy } from "./consent-copy";

interface ConsentClientProps {
  applications: ConsentApplication[];
  selectedApplication: ConsentApplication | null;
  consentStatuses: ConsentDocumentStatus[];
  consentHistory: ConsentHistoryEvent[];
  signatureStatus: SignatureStatus;
  progressCounts: ConsentProgressCounts;
  nextStep: NextConsentStep;
  applicantName: string | null;
}

interface SignaturePadProps {
  disabled: boolean;
  onDrawChange: (hasDrawn: boolean) => void;
  copy: ConsentCopy;
}

function formatDate(value: string | null, isZh: boolean): string {
  if (!value) return isZh ? "未记录" : "Not recorded";
  return new Intl.DateTimeFormat(isZh ? "zh-CN" : undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const SignaturePad = forwardRef<HTMLCanvasElement, SignaturePadProps>(
  ({ disabled, onDrawChange, copy }, ref) => {
    const localRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);

    const setRefs = useCallback(
      (node: HTMLCanvasElement | null) => {
        localRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    const prepareCanvas = useCallback(() => {
      const canvas = localRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));

      const context = canvas.getContext("2d");
      if (!context) return;

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 2;
      context.strokeStyle = "#111827";
    }, []);

    useEffect(() => {
      prepareCanvas();

      const handleResize = () => {
        prepareCanvas();
        onDrawChange(false);
      };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [onDrawChange, prepareCanvas]);

    const getPoint = (event: PointerEvent<HTMLCanvasElement>) => {
      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;

      const context = event.currentTarget.getContext("2d");
      if (!context) return;

      const point = getPoint(event);
      drawingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      context.beginPath();
      context.moveTo(point.x, point.y);
    };

    const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || disabled) return;

      const context = event.currentTarget.getContext("2d");
      if (!context) return;

      const point = getPoint(event);
      context.lineTo(point.x, point.y);
      context.stroke();
      onDrawChange(true);
    };

    const finishDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    };

    const clearCanvas = () => {
      prepareCanvas();
      onDrawChange(false);
    };

    return (
      <div className="space-y-3">
        <canvas
          ref={setRefs}
          className={cn(
            "h-40 w-full touch-none rounded-lg border border-input bg-white shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
            disabled && "cursor-not-allowed opacity-60",
          )}
          aria-label={copy.drawSignatureAriaLabel}
          role="img"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          onPointerLeave={finishDrawing}
        />
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input bg-white px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50"
          disabled={disabled}
          onClick={clearCanvas}
        >
          <Eraser className="h-4 w-4" />
          {copy.clearSignature}
        </button>
      </div>
    );
  },
);
SignaturePad.displayName = "SignaturePad";

export function ConsentClient({
  applications,
  selectedApplication,
  consentStatuses,
  consentHistory,
  signatureStatus,
  progressCounts,
  nextStep,
  applicantName,
}: ConsentClientProps) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const copy = getConsentCopy(isZh);
  const displayNextStep = localizeNextStep(nextStep, isZh);
  const router = useRouter();
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [checkedConsents, setCheckedConsents] = useState<Record<string, boolean>>({});
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("typed");
  const [signerName, setSignerName] = useState("");
  const [typedSignature, setTypedSignature] = useState("");
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCheckedConsents({});
    setSignatureMode("typed");
    setSignerName("");
    setTypedSignature("");
    setHasDrawnSignature(false);
    setFormError(null);
  }, [selectedApplication?.id]);

  const missingConsents = useMemo(
    () => consentStatuses.filter((document) => !document.currentVersionAccepted),
    [consentStatuses],
  );

  const allCurrentConsentsAccepted = missingConsents.length === 0;
  const needsSignature = !signatureStatus.currentVersionSigned;
  const hasWorkToSubmit = missingConsents.length > 0 || needsSignature;
  const allMissingConsentsChecked = missingConsents.every(
    (document) => checkedConsents[document.consentType] === true,
  );
  const hasTypedSignature = typedSignature.trim().length >= 2;
  const hasSignerName = signerName.trim().length >= 2;
  const signatureReady =
    !needsSignature ||
    (hasSignerName &&
      (signatureMode === "typed" ? hasTypedSignature : hasDrawnSignature));
  const canSubmit =
    Boolean(selectedApplication) &&
    hasWorkToSubmit &&
    allMissingConsentsChecked &&
    signatureReady &&
    !isPending;

  const completionState =
    allCurrentConsentsAccepted && signatureStatus.currentVersionSigned
      ? "complete"
      : "blocked";

  const isDs160Application =
    selectedApplication?.country === "united_states" ||
    selectedApplication?.visaType === "DS160" ||
    selectedApplication?.visaType === "B1_B2";

  const updateConsentCheck = (consentType: string, checked: boolean) => {
    setCheckedConsents((current) => ({
      ...current,
      [consentType]: checked,
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!selectedApplication) {
      setFormError(copy.consentRequired);
      return;
    }

    if (!allMissingConsentsChecked) {
      setFormError(copy.acceptEachVersion);
      return;
    }

    let signaturePayload: ConsentSubmissionInput["signature"];
    if (needsSignature) {
      if (!hasSignerName) {
        setFormError(copy.applicantNameRequired);
        return;
      }

      if (signatureMode === "typed") {
        if (!hasTypedSignature) {
          setFormError(copy.typedSignatureRequired);
          return;
        }
        signaturePayload = {
          signerName: signerName.trim(),
          signatureText: typedSignature.trim(),
          mode: "typed",
        };
      } else {
        const canvas = signatureCanvasRef.current;
        if (!canvas || !hasDrawnSignature) {
          setFormError(copy.drawnSignatureRequired);
          return;
        }
        signaturePayload = {
          signerName: signerName.trim(),
          signatureText: canvas.toDataURL("image/png"),
          mode: "drawn",
        };
      }
    }

    startTransition(async () => {
      const result = await acceptConsentAndSignature({
        applicationId: selectedApplication.id,
        acceptedConsentTypes: missingConsents.map((document) => document.consentType),
        signature: signaturePayload,
      });

      if (!result.success) {
        setFormError(result.error ?? copy.saveFailed);
        return;
      }

      if (result.nextHref) {
        router.push(result.nextHref);
        return;
      }

      router.refresh();
    });
  };

  if (!selectedApplication) {
    return (
      <div className="mx-auto flex w-full max-w-[1090px] flex-col gap-6">
        <div className="space-y-3">
          <Badge variant="static" className="w-fit bg-brand-50 text-brand-500">
            {copy.gate}
          </Badge>
          <h1 className="text-3xl font-semibold text-foreground">
            {copy.title}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            {isZh
              ? "同意记录会绑定到具体签证申请。请先开始申请，才能正确保存接受的版本和签名。"
              : "Consent is recorded per visa application. Start an application first so accepted versions and signatures can be scoped correctly."}
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {copy.noApplicationTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.noApplicationBody}
              </p>
            </div>
            <Link
              href="/client/application"
              className={cn(brandActionButtonVariants(), "w-full sm:w-auto")}
            >
              {copy.startApplication}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1090px] flex-col gap-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge variant="static" className="w-fit bg-brand-50 text-brand-500">
            {copy.gate}
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">
              {copy.title}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              {isZh
                ? "请接受当前法律文件版本并签署 VIZA 机构授权，之后才能生成申请资料包或继续任何外部交接。"
                : "Accept the current legal versions and sign the VIZA agency mandate before packet generation or any external handoff can continue."}
            </p>
          </div>
        </div>
        <Link
          href={nextStep.href}
          className={cn(
            brandActionButtonVariants({
              variant: completionState === "complete" ? "primary" : "secondary",
            }),
            "w-full sm:w-auto",
          )}
        >
          {displayNextStep.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {applications.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {applications.map((application) => {
            const selected = application.id === selectedApplication.id;
            return (
              <Link
                key={application.id}
                href={`/client/consent?applicationId=${encodeURIComponent(application.id)}`}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                  selected
                    ? "border-brand-500 bg-brand-50 text-brand-500"
                    : "border-input bg-white text-muted-foreground hover:bg-muted",
                )}
                aria-current={selected ? "page" : undefined}
              >
                {localizeApplicationName(application, isZh)}
              </Link>
            );
          })}
        </div>
      )}

      <div
        className={cn(
          "rounded-xl border p-4",
          completionState === "complete"
            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : "border-amber-200 bg-amber-50 text-amber-950",
        )}
      >
        <div className="flex gap-3">
          {completionState === "complete" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div className="space-y-1">
            <p className="font-medium">
              {completionState === "complete"
                ? copy.completeBody
                : copy.incompleteBody}
            </p>
            <p className="text-sm leading-6">
              {displayNextStep.reason}
            </p>
          </div>
        </div>
      </div>

      {isDs160Application && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <p className="text-sm leading-6">
              {copy.ds160Boundary}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
        <div className="flex gap-3">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div className="space-y-1">
            <p className="font-medium">{copy.mailboxTitle}</p>
            <p className="text-sm leading-6">{copy.mailboxBody}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5 text-brand-500" />
                {copy.currentVersions}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {consentStatuses.map((document) => {
                const localizedDocument = localizeConsentDocument(document, isZh);
                const needsAcceptance = !document.currentVersionAccepted;
                return (
                  <div
                    key={document.consentType}
                    className="rounded-xl border border-input bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">
                            {localizedDocument.title}
                          </h2>
                          <Badge
                            variant="static"
                            className={cn(
                              document.currentVersionAccepted
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700",
                            )}
                          >
                            {document.currentVersionAccepted
                              ? copy.currentAccepted
                              : copy.acceptanceNeeded}
                          </Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {localizedDocument.summary}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>
                            {copy.currentVersion} {document.version}
                          </span>
                          {document.acceptedVersion ? (
                            <span>
                              {copy.lastAccepted(
                                document.acceptedVersion,
                                formatDate(document.acceptedAt, isZh),
                              )}
                            </span>
                          ) : (
                            <span>{copy.noAcceptedVersion}</span>
                          )}
                        </div>
                        {document.href && (
                          <Link
                            href={document.href}
                            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-500 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                          >
                            {copy.readDocument(localizedDocument.shortTitle)}
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                      {needsAcceptance ? (
                        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-input bg-muted/30 p-3 text-sm leading-6 text-foreground">
                          <Checkbox
                            className="mt-1 h-5 w-5"
                            checked={checkedConsents[document.consentType] === true}
                            onCheckedChange={(checked) =>
                              updateConsentCheck(document.consentType, checked === true)
                            }
                            aria-label={
                              isZh
                                ? `接受${localizedDocument.title}版本 ${document.version}`
                                : `Accept ${localizedDocument.title} version ${document.version}`
                            }
                          />
                          <span>
                            {copy.acceptVersion(document.version)}
                          </span>
                        </label>
                      ) : (
                        <div className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-sm font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          {copy.accepted}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileSignature className="h-5 w-5 text-brand-500" />
                {copy.agencySignature}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border border-input bg-white p-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  {copy.agencySignatureBody}
                </p>
                <div className="mt-3 text-xs text-muted-foreground">
                  {copy.mandateVersion} {AGENCY_AUTHORISATION_DOCUMENT.version}
                </div>
              </div>

              {signatureStatus.currentVersionSigned ? (
                <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    {copy.signedAuthorisation}
                  </div>
                  <p className="text-sm">
                    {copy.signedBy(
                      signatureStatus.signerName ?? (isZh ? "申请人" : "Applicant"),
                      formatDate(signatureStatus.signedAt, isZh),
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {signatureStatus.signedAt && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                      {copy.previousSignature(
                        formatDate(signatureStatus.signedAt, isZh),
                      )}
                    </div>
                  )}

                  <BrandField
                    label={copy.applicantLegalName}
                    htmlFor="signer-name"
                    required
                    hint={applicantName ? copy.applicantNameHint(applicantName) : undefined}
                  >
                    <BrandInput
                      id="signer-name"
                      value={signerName}
                      onChange={(event) => setSignerName(event.target.value)}
                      placeholder={copy.applicantLegalName}
                      disabled={isPending}
                    />
                  </BrandField>

                  <div className="flex w-full rounded-full border border-input bg-white p-1">
                    {(["typed", "drawn"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={cn(
                          "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                          signatureMode === mode
                            ? "bg-brand-500 text-white"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                        disabled={isPending}
                        onClick={() => setSignatureMode(mode)}
                      >
                        {mode === "typed" ? (
                          <PenLine className="h-4 w-4" />
                        ) : (
                          <FileSignature className="h-4 w-4" />
                        )}
                        {mode === "typed" ? copy.typed : copy.drawn}
                      </button>
                    ))}
                  </div>

                  {signatureMode === "typed" ? (
                    <BrandField
                      label={copy.typedSignature}
                      htmlFor="typed-signature"
                      required
                      hint={copy.typedSignatureHint}
                    >
                      <BrandInput
                        id="typed-signature"
                        value={typedSignature}
                        onChange={(event) => setTypedSignature(event.target.value)}
                        placeholder={copy.typedSignaturePlaceholder}
                        disabled={isPending}
                      />
                    </BrandField>
                  ) : (
                    <BrandField
                      label={copy.drawnSignature}
                      required
                      hint={copy.drawnSignatureHint}
                    >
                      <SignaturePad
                        ref={signatureCanvasRef}
                        disabled={isPending}
                        onDrawChange={setHasDrawnSignature}
                        copy={copy}
                      />
                    </BrandField>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {formError && (
            <div
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              role="alert"
            >
              {formError}
            </div>
          )}

          {hasWorkToSubmit ? (
            <BrandActionButton
              type="submit"
              className="w-full sm:w-auto"
              disabled={!canSubmit}
              loading={isPending}
              loadingText={copy.saving}
            >
              {copy.saveContinue}
              <ArrowRight className="h-4 w-4" />
            </BrandActionButton>
          ) : null}
        </form>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{copy.application}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {localizeApplicationName(selectedApplication, isZh)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {isZh ? selectedApplication.countryNameZh : selectedApplication.countryName} ·{" "}
                  {isZh ? selectedApplication.visaTypeLabelZh : selectedApplication.visaTypeLabel}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">{copy.status}</div>
                  <div className="mt-1 font-medium capitalize">
                    {localizeStatus(selectedApplication.status, isZh)}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">{copy.packet}</div>
                  <div className="mt-1 font-medium capitalize">
                    {localizeStatus(
                      selectedApplication.packetStatus ?? "not_started",
                      isZh,
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{copy.readiness}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: copy.currentLegalVersions,
                  done: allCurrentConsentsAccepted,
                  detail: allCurrentConsentsAccepted
                    ? copy.allAccepted
                    : copy.remaining(missingConsents.length),
                },
                {
                  label: copy.agencyAuthorisation,
                  done: signatureStatus.currentVersionSigned,
                  detail: signatureStatus.currentVersionSigned ? copy.signed : copy.unsigned,
                },
                {
                  label: copy.applicationAnswers,
                  done: progressCounts.answerCount > 0,
                  detail: copy.fieldsSaved(progressCounts.answerCount),
                },
                {
                  label: copy.documents,
                  done:
                    progressCounts.documents.total > 0 &&
                    progressCounts.documents.missing === 0 &&
                    progressCounts.documents.rejected === 0,
                  detail:
                    progressCounts.documents.total > 0
                      ? copy.documentsReady(
                          progressCounts.documents.ready,
                          progressCounts.documents.total,
                        )
                      : copy.noDocuments,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {item.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.detail}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{copy.acceptedVersions}</CardTitle>
            </CardHeader>
            <CardContent>
              {consentHistory.length > 0 ? (
                <div className="space-y-3">
                  {consentHistory.map((event) => (
                    <div key={event.id} className="border-l-2 border-brand-200 pl-3">
                      <div className="text-sm font-medium text-foreground">
                        {localizeConsentDocument(event, isZh).title} v{event.version}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(event.acceptedAt, isZh)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  {copy.noConsentHistory}
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

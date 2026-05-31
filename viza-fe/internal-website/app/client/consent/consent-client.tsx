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
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Eraser,
  ExternalLink,
  FileSignature,
  PenLine,
  ShieldCheck,
} from "lucide-react";
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
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function applicationLabel(application: ConsentApplication, isZh: boolean): string {
  const countryName = isZh ? application.countryNameZh : application.countryName;
  const visaTypeLabel = isZh ? application.visaTypeLabelZh : application.visaTypeLabel;
  return `${application.countryFlag} ${countryName} ${visaTypeLabel}`;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

const SignaturePad = forwardRef<HTMLCanvasElement, SignaturePadProps>(
  ({ disabled, onDrawChange }, ref) => {
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
          aria-label="Draw agency authorisation signature"
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
          Clear signature
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
      setFormError("Start or select an application before recording consent.");
      return;
    }

    if (!allMissingConsentsChecked) {
      setFormError("Review and explicitly accept each current document version.");
      return;
    }

    let signaturePayload: ConsentSubmissionInput["signature"];
    if (needsSignature) {
      if (!hasSignerName) {
        setFormError("Enter the applicant legal name before signing.");
        return;
      }

      if (signatureMode === "typed") {
        if (!hasTypedSignature) {
          setFormError("Type the applicant name as the e-signature.");
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
          setFormError("Draw the applicant signature before submitting.");
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
        setFormError(result.error ?? "Consent could not be saved.");
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
            Consent gate
          </Badge>
          <h1 className="text-3xl font-semibold text-foreground">
            Consent and authorisation
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Consent is recorded per visa application. Start an application first so
            accepted versions and signatures can be scoped correctly.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                No application found
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                VIZA needs an application record before ToS, Privacy, authorisation,
                and e-signature can be saved.
              </p>
            </div>
            <Link
              href="/client/application"
              className={cn(brandActionButtonVariants(), "w-full sm:w-auto")}
            >
              Start application
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
            Consent gate
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">
              Consent and authorisation
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              Accept the current legal versions and sign the VIZA agency mandate
              before packet generation or any external handoff can continue.
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
          {nextStep.label}
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
                {applicationLabel(application, isZh)}
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
                ? "Consent is complete for this application."
                : "Consent is still blocking this application."}
            </p>
            <p className="text-sm leading-6">
              {nextStep.reason}
            </p>
          </div>
        </div>
      </div>

      {isDs160Application && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <p className="text-sm leading-6">
              DS-160 boundary: this VIZA signature authorises preparation and
              support inside VIZA only. The official DS-160 final signature,
              CAPTCHA, and government submission are not completed or marked
              complete inside VIZA.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5 text-brand-500" />
                Current document versions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {consentStatuses.map((document) => {
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
                            {document.title}
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
                              ? "Current accepted"
                              : "Current acceptance needed"}
                          </Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {document.summary}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Current version {document.version}</span>
                          {document.acceptedVersion ? (
                            <span>
                              Last accepted {document.acceptedVersion} on{" "}
                              {formatDate(document.acceptedAt)}
                            </span>
                          ) : (
                            <span>No accepted version recorded</span>
                          )}
                        </div>
                        {document.href && (
                          <Link
                            href={document.href}
                            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-500 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                          >
                            Read {document.shortTitle}
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
                            aria-label={`Accept ${document.title} version ${document.version}`}
                          />
                          <span>
                            I have read and accept version {document.version}.
                          </span>
                        </label>
                      ) : (
                        <div className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-sm font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Accepted
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
                Agency authorisation signature
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border border-input bg-white p-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  By signing, the applicant authorises VIZA to prepare application
                  materials, review documents, generate the VIZA packet, and support
                  handoff steps for this application. This does not authorise VIZA
                  to complete any official final signature or government submission
                  step that must be performed by the applicant.
                </p>
                <div className="mt-3 text-xs text-muted-foreground">
                  Mandate version {AGENCY_AUTHORISATION_DOCUMENT.version}
                </div>
              </div>

              {signatureStatus.currentVersionSigned ? (
                <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Signed current authorisation
                  </div>
                  <p className="text-sm">
                    {signatureStatus.signerName ?? "Applicant"} signed on{" "}
                    {formatDate(signatureStatus.signedAt)}.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {signatureStatus.signedAt && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                      A previous authorisation was signed on{" "}
                      {formatDate(signatureStatus.signedAt)}, but the current
                      mandate version still needs a signature.
                    </div>
                  )}

                  <BrandField
                    label="Applicant legal name"
                    htmlFor="signer-name"
                    required
                    hint={applicantName ? `Use the applicant name shown on the application: ${applicantName}` : undefined}
                  >
                    <BrandInput
                      id="signer-name"
                      value={signerName}
                      onChange={(event) => setSignerName(event.target.value)}
                      placeholder="Enter applicant legal name"
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
                        {mode}
                      </button>
                    ))}
                  </div>

                  {signatureMode === "typed" ? (
                    <BrandField
                      label="Typed e-signature"
                      htmlFor="typed-signature"
                      required
                      hint="Typing the applicant name here creates the VIZA agency authorisation signature record."
                    >
                      <BrandInput
                        id="typed-signature"
                        value={typedSignature}
                        onChange={(event) => setTypedSignature(event.target.value)}
                        placeholder="Type applicant full name"
                        disabled={isPending}
                      />
                    </BrandField>
                  ) : (
                    <BrandField
                      label="Drawn e-signature"
                      required
                      hint="Draw with a mouse, trackpad, stylus, or finger. The image is submitted to the server with this form."
                    >
                      <SignaturePad
                        ref={signatureCanvasRef}
                        disabled={isPending}
                        onDrawChange={setHasDrawnSignature}
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
              loadingText="Saving consent"
            >
              Save and continue
              <ArrowRight className="h-4 w-4" />
            </BrandActionButton>
          ) : null}
        </form>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Application</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {applicationLabel(selectedApplication, isZh)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {isZh ? selectedApplication.countryNameZh : selectedApplication.countryName} ·{" "}
                  {isZh ? selectedApplication.visaTypeLabelZh : selectedApplication.visaTypeLabel}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1 font-medium capitalize">
                    {statusLabel(selectedApplication.status)}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">Packet</div>
                  <div className="mt-1 font-medium capitalize">
                    {statusLabel(selectedApplication.packetStatus ?? "not_started")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Readiness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: "Current legal versions",
                  done: allCurrentConsentsAccepted,
                  detail: allCurrentConsentsAccepted
                    ? "All accepted"
                    : `${missingConsents.length} remaining`,
                },
                {
                  label: "Agency authorisation",
                  done: signatureStatus.currentVersionSigned,
                  detail: signatureStatus.currentVersionSigned ? "Signed" : "Unsigned",
                },
                {
                  label: "Application answers",
                  done: progressCounts.answerCount > 0,
                  detail: `${progressCounts.answerCount} fields saved`,
                },
                {
                  label: "Documents",
                  done:
                    progressCounts.documents.total > 0 &&
                    progressCounts.documents.missing === 0 &&
                    progressCounts.documents.rejected === 0,
                  detail:
                    progressCounts.documents.total > 0
                      ? `${progressCounts.documents.ready}/${progressCounts.documents.total} ready`
                      : "No documents yet",
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
              <CardTitle className="text-lg">Accepted versions</CardTitle>
            </CardHeader>
            <CardContent>
              {consentHistory.length > 0 ? (
                <div className="space-y-3">
                  {consentHistory.map((event) => (
                    <div key={event.id} className="border-l-2 border-brand-200 pl-3">
                      <div className="text-sm font-medium text-foreground">
                        {event.title} v{event.version}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(event.acceptedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  No consent versions have been accepted for this application yet.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

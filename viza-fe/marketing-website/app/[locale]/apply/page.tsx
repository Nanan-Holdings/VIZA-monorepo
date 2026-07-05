"use client";
import "./apply.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleFlag } from "react-circle-flags";
import SiteNav from "@/components/SiteNav";
import { PayByCardButton } from "@/components/PayByCardButton";
import { WechatPayButton } from "@/components/WechatPayButton";
import { countryBySlug } from "@/lib/countries";

type PassportExtraction = {
  surname: string;
  givenNames: string;
  dob: string;
  sex: "Male" | "Female" | "";
  nationality: string;
  cityOfBirth?: string;
  countryOfBirth?: string;
  passportNumber: string;
  passportType?: string;
  issuingCountry: string;
  issuanceCity?: string;
  issuanceProvince?: string;
  issueDate: string;
  expiryDate: string;
  confidence: "high" | "medium" | "low";
  warnings?: string[];
};

type ExtractStage = "idle" | "reading" | "extracting" | "verifying" | "done";

type Step = 1 | 2 | 3;
type Speed = "standard" | "express" | "superrush";
type Addon = "insurance" | "esim";

// Base price: government fee (50) + VIZA processing (32) − first-time discount (10).
const BASE_PRICE = 50 + 32 - 10;
const SPEED_PRICE: Record<Speed, number> = { standard: 0, express: 28, superrush: 89 };
const ADDON_PRICE: Record<Addon, number> = { insurance: 32, esim: 12 };

// ISO 3166-1 alpha-3 → { alpha-2, English name }. Covers the destinations and
// passport-issuing countries most relevant to the apply flow; falls back to the
// raw alpha-3 code if a country isn't listed.
const COUNTRY_MAP: Record<string, { a2: string; name: string }> = {
  SGP: { a2: "sg", name: "Singapore" },
  MYS: { a2: "my", name: "Malaysia" },
  IDN: { a2: "id", name: "Indonesia" },
  THA: { a2: "th", name: "Thailand" },
  VNM: { a2: "vn", name: "Vietnam" },
  PHL: { a2: "ph", name: "Philippines" },
  CHN: { a2: "cn", name: "China" },
  HKG: { a2: "hk", name: "Hong Kong" },
  TWN: { a2: "tw", name: "Taiwan" },
  JPN: { a2: "jp", name: "Japan" },
  KOR: { a2: "kr", name: "South Korea" },
  IND: { a2: "in", name: "India" },
  USA: { a2: "us", name: "United States" },
  GBR: { a2: "gb", name: "United Kingdom" },
  AUS: { a2: "au", name: "Australia" },
  NZL: { a2: "nz", name: "New Zealand" },
  CAN: { a2: "ca", name: "Canada" },
  FRA: { a2: "fr", name: "France" },
  DEU: { a2: "de", name: "Germany" },
  NLD: { a2: "nl", name: "Netherlands" },
  CHE: { a2: "ch", name: "Switzerland" },
  ITA: { a2: "it", name: "Italy" },
  ESP: { a2: "es", name: "Spain" },
  ARE: { a2: "ae", name: "United Arab Emirates" },
};

function formatDateDisplay(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIdx = Number(m) - 1;
  if (monthIdx < 0 || monthIdx > 11) return iso;
  return `${Number(d)} ${months[monthIdx]} ${y}`;
}

function CountryDisplay({ alpha3 }: { alpha3: string }) {
  const entry = COUNTRY_MAP[alpha3?.toUpperCase()];
  if (!entry) return <>{alpha3 || "—"}</>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <CircleFlag countryCode={entry.a2} height={16} />
      {entry.name}
    </span>
  );
}

const CheckMark = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

export default function ApplyPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // The wizard is country-aware: /apply?country=<slug> drives the destination
  // identity (name, flag, visa type) and the final-step checkout deep-links.
  // Defaults to Indonesia for a bare /apply (back-compat). Read from the URL on
  // the client to keep this page statically renderable.
  const [countrySlug, setCountrySlug] = useState("indonesia");
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("country");
    if (c && countryBySlug(c)) setCountrySlug(c);
  }, []);
  const country = countryBySlug(countrySlug) ?? countryBySlug("indonesia")!;

  const locale = useLocale();
  const tA = useTranslations("apply");
  const tF = useTranslations("footer");
  const tc = useTranslations("countries");
  const countryName = tc.has(country.slug) ? tc(country.slug) : country.name;

  // -------------- WIZARD STATE --------------
  const [step, setStep] = useState<Step>(1);
  const [uploadMode, setUploadMode] = useState<"upload" | "capture">("upload");
  const [dragOver, setDragOver] = useState(false);
  const [selectedDate, setSelectedDate] = useState(2);
  const [speed, setSpeed] = useState<Speed>("express");
  const [addons, setAddons] = useState<Record<Addon, boolean>>({ insurance: false, esim: false });

  const goStep = useCallback((n: Step) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const toggleAddon = useCallback((a: Addon) => {
    setAddons((prev) => ({ ...prev, [a]: !prev[a] }));
  }, []);

  const [extractStage, setExtractStage] = useState<ExtractStage>("idle");
  const [extracted, setExtracted] = useState<PassportExtraction | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const runExtraction = useCallback(async (file: File) => {
    if (!file) return;
    setExtracted(null);
    setExtractError(null);
    setExtractStage("reading");

    const form = new FormData();
    form.append("file", file);

    try {
      // "Reading" is the small UX delay before the upload completes — keep it
      // honest by tying it to the in-flight POST rather than a fixed timer.
      setExtractStage("extracting");
      const res = await fetch("/api/passport-scan/extract", {
        method: "POST",
        body: form,
      });

      const body = (await res.json().catch(() => null)) as
        | { error?: boolean; extracted?: PassportExtraction; message?: string }
        | null;

      if (!res.ok || !body || body.error) {
        const detail = body?.message || `HTTP ${res.status}`;
        throw new Error(detail);
      }

      const data = body.extracted;
      if (!data) throw new Error("Empty response");

      setExtractStage("verifying");
      // Brief verifying stage so users see the third checkmark animate in
      // before the page jumps to step 2.
      await new Promise((r) => setTimeout(r, 600));

      setExtracted(data);
      setExtractStage("done");

      try {
        sessionStorage.setItem("viza.passport.extracted", JSON.stringify(data));
      } catch {
        // sessionStorage may be blocked (private mode, etc.) — non-fatal.
      }

      setTimeout(() => goStep(2), 400);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : String(err));
      setExtractStage("idle");
    }
  }, [goStep]);

  const onFilePicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) runExtraction(file);
      // Allow re-selecting the same file after a reset.
      e.target.value = "";
    },
    [runExtraction],
  );

  const onDzClick = useCallback(() => {
    if (extractStage === "idle") fileInputRef.current?.click();
  }, [extractStage]);

  const onDzDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (extractStage !== "idle") return;
      const file = e.dataTransfer.files?.[0];
      if (file) runExtraction(file);
    },
    [extractStage, runExtraction],
  );

  const onDzDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDzDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // -------------- STEP 3: dates (base date fixed to the demo window) --------------
  const isZh = locale.toLowerCase().startsWith("zh");
  const dayNames = isZh
    ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = isZh
    ? ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const arrivalDates = useMemo(() => {
    const today = new Date("2026-05-08T00:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  // -------------- DERIVED PRICING / SUMMARY --------------
  const speedAdd = SPEED_PRICE[speed];
  const addonsAdd = (addons.insurance ? ADDON_PRICE.insurance : 0) + (addons.esim ? ADDON_PRICE.esim : 0);
  const total = BASE_PRICE + speedAdd + addonsAdd;

  const upgradeParts: string[] = [];
  if (speed !== "standard") upgradeParts.push(speed === "express" ? tA("express") : tA("superRush"));
  if (addons.insurance) upgradeParts.push(tA("insurance"));
  if (addons.esim) upgradeParts.push(tA("esim"));

  const sumEta =
    speed === "standard" ? tA("etaStandard") :
    speed === "superrush" ? tA("etaSuperrush") :
    tA("etaExpress");

  // -------------- DERIVED EXTRACTION VIEW STATE --------------
  const isUploading = extractStage !== "idle";
  const rowDoneReading = extractStage === "extracting" || extractStage === "verifying" || extractStage === "done";
  const rowDoneExtracting = extractStage === "verifying" || extractStage === "done";
  const rowDoneVerifying = extractStage === "done";

  const stageBtnLabel =
    extractStage === "reading" ? tA("stReading") :
    extractStage === "extracting" ? tA("stExtracting") :
    extractStage === "verifying" ? tA("stVerifying") :
    tA("continue");

  // -------------- DERIVED WIZARD CHROME --------------
  const stepNames: Record<Step, string> = {
    1: tA("step1Name"),
    2: tA("step2Name"),
    3: tA("step3Name"),
  };
  const stepNext: Record<Step, string> = {
    1: tA("continue"),
    2: tA("continueToCheckout"),
    3: tA("continue"),
  };

  // Step 3 = checkout: payment method is chosen via the inline card/WeChat
  // buttons, so the bottom Next button is hidden there (label kept in sync
  // with the running total to mirror the ported design).
  const nextLabel =
    step === 3 ? tA("payAmount", { amount: total.toFixed(2) }) :
    step === 1 && isUploading ? stageBtnLabel :
    stepNext[step];

  const canProceed = step === 2 || step === 3;

  const onBack = useCallback(() => {
    setStep((s) => {
      if (s > 1) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return (s - 1) as Step;
      }
      return s;
    });
  }, []);

  const onNext = useCallback(() => {
    if (!canProceed) return;
    // Step 3 is the checkout step — payment method (card / WeChat) is chosen
    // via the inline buttons that deep-link to the portal checkout, so the
    // bottom Next button does nothing here (it is also hidden).
    if (step === 3) return;
    goStep((step + 1) as Step);
  }, [canProceed, step, goStep]);

  const showWarning =
    extracted !== null &&
    (extracted.confidence !== "high" || (extracted.warnings ?? []).length > 0);

  const pstepClass = (n: Step) =>
    `pstep${n < step ? " done" : ""}${n === step ? " current" : ""}`;

  return (
    <>
      <SiteNav />

      <div className="progress-bar">
        <div className="progress-inner" id="progressBar">
          <div className={pstepClass(1)} data-step="1">
            <span className="num">{step > 1 ? <CheckMark /> : "1"}</span>
            <span className="lab">{tA("step1Name")}</span>
          </div>
          <span className={`pconn${step > 1 ? " done" : ""}`}></span>
          <div className={pstepClass(2)} data-step="2">
            <span className="num">{step > 2 ? <CheckMark /> : "2"}</span>
            <span className="lab">{tA("step2Name")}</span>
          </div>
          <span className={`pconn${step > 2 ? " done" : ""}`}></span>
          <div className={pstepClass(3)} data-step="3">
            <span className="num">3</span>
            <span className="lab">{tA("step3Name")}</span>
          </div>
        </div>
      </div>

      <div className={`frame${step === 3 ? " with-summary" : ""}`} id="frame">

        <main className="main">

          {/* ============= STEP 1: UPLOAD ============= */}
          <section className={`step step-pane${step === 1 ? " active" : ""}`} data-pane="1">
            <header className="step-head">
              <div className="step-eyebrow">{tA("stepOf", { n: 1 })}</div>
              <h1>{tA("s1Title")}</h1>
              <p>{tA("s1Desc")}</p>
            </header>

            <div className="seg" id="uploadSeg" style={{ display: isUploading ? "none" : undefined }}>
              <button
                className={uploadMode === "upload" ? "active" : ""}
                data-mode="upload"
                type="button"
                onClick={() => setUploadMode("upload")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {tA("segUpload")}
              </button>
              <button
                className={uploadMode === "capture" ? "active" : ""}
                data-mode="capture"
                type="button"
                onClick={() => setUploadMode("capture")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                {tA("segCapture")}
              </button>
            </div>

            {/* Hidden file input — clicked via dropzone */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={onFilePicked}
            />

            {/* Pre-upload view */}
            {!isUploading && (
              <div id="uploadView">
                <div
                  className={`dropzone${dragOver ? " drag" : ""}`}
                  id="dz"
                  onClick={onDzClick}
                  onDrop={onDzDrop}
                  onDragOver={onDzDragOver}
                  onDragEnter={onDzDragOver}
                  onDragLeave={onDzDragLeave}
                >
                  <div className="dz-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="11.5" cy="14.5" r="2.5"/><path d="M9 19l3-3 3 3"/></svg>
                  </div>
                  <div className="dz-title">{tA("dzTitle")}</div>
                  <div className="dz-sub">{tA("dzSub")}</div>
                  <button
                    className="dz-browse"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {tA("dzBrowse")}
                  </button>
                  <div className="dz-formats">
                    <span className="pill">JPG</span>
                    <span className="pill">PNG</span>
                    <span className="pill">WebP</span>
                    <span>{tA("dzUpTo")}</span>
                  </div>
                </div>

                {extractError && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 16,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#991b1b",
                      font: "500 13px/1.45 var(--font-sans)",
                    }}
                  >
                    {tA("errReadFail", { detail: extractError })}
                  </div>
                )}

                <div className="tips">
                  <div className="tip">
                    <div className="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div><div className="tt">{tA("tip1Title")}</div><div className="ts">{tA("tip1Sub")}</div></div>
                  </div>
                  <div className="tip">
                    <div className="ico warn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg></div>
                    <div><div className="tt">{tA("tip2Title")}</div><div className="ts">{tA("tip2Sub")}</div></div>
                  </div>
                  <div className="tip">
                    <div className="ico bad"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></svg></div>
                    <div><div className="tt">{tA("tip3Title")}</div><div className="ts">{tA("tip3Sub")}</div></div>
                  </div>
                </div>
              </div>
            )}

            {/* Inline post-upload extraction */}
            {isUploading && (
              <div id="extractView">
                <div className="extract-inline">
                  <div className="scan-doc">
                    <div className="pp">
                      <i className="pp-row"></i><i className="pp-row"></i><i className="pp-row"></i><i className="pp-row"></i><i className="pp-row"></i>
                    </div>
                    <div className="scanline"></div>
                  </div>
                  <div className="extract-list" id="extractList">
                    <div
                      className={`extract-row ${rowDoneReading ? "done" : extractStage === "reading" ? "active" : ""}`}
                      data-i="0"
                    >
                      <div className="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                      <span className="lab">{tA("extReading")}</span>
                    </div>
                    <div
                      className={`extract-row ${rowDoneExtracting ? "done" : extractStage === "extracting" ? "active" : ""}`}
                      data-i="1"
                    >
                      <div className="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                      <span className="lab">{tA("extExtracting")}</span>
                    </div>
                    <div
                      className={`extract-row ${rowDoneVerifying ? "done" : extractStage === "verifying" ? "active" : ""}`}
                      data-i="2"
                    >
                      <div className="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                      <span className="lab">{tA("extVerifying")}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ============= STEP 2: CONFIRM ============= */}
          <section className={`step step-pane${step === 2 ? " active" : ""}`} data-pane="2">
            <header className="step-head">
              <div className="step-eyebrow">{tA("stepOf", { n: 2 })}</div>
              <h1>{tA("s2Title")}</h1>
              <p>{tA("s2Desc")}</p>
            </header>

            {extracted && !showWarning && (
              <div className="step-success-strip show">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {tA("successHigh")}
              </div>
            )}
            {extracted && showWarning && (
              <div
                className="step-success-strip show"
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #fde68a",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                {extracted.confidence === "low" ? tA("warnLow") : tA("warnMed")}
              </div>
            )}

            <div className="review-card">
              <div className="review-head">
                <h3>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {tA("ppDetails")}
                </h3>
                <span className="verified"><span className="dot"></span> {tA("autoExtracted")}</span>
              </div>
              <div className="review-grid">
                <div className="review-field">
                  <div className="k">{tA("fSurname")}</div>
                  <div className="v">{extracted?.surname || "—"}</div>
                  <button className="edit" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                </div>
                <div className="review-field">
                  <div className="k">{tA("fGiven")}</div>
                  <div className="v">{extracted?.givenNames || "—"}</div>
                  <button className="edit" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                </div>
                <div className="review-field">
                  <div className="k">{tA("fPassport")}</div>
                  <div className="v">{extracted?.passportNumber || "—"}</div>
                  <button className="edit" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                </div>
                <div className="review-field">
                  <div className="k">{tA("fDob")}</div>
                  <div className="v">{formatDateDisplay(extracted?.dob ?? "")}</div>
                  <button className="edit" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                </div>
                <div className="review-field">
                  <div className="k">{tA("fNationality")}</div>
                  <div className="v">
                    {extracted ? <CountryDisplay alpha3={extracted.nationality} /> : "—"}
                  </div>
                  <button className="edit" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                </div>
                <div className="review-field">
                  <div className="k">{tA("fExpires")}</div>
                  <div className="v">{formatDateDisplay(extracted?.expiryDate ?? "")}</div>
                  <button className="edit" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                </div>
              </div>
            </div>

            <h2 style={{ font: '500 18px/1.2 var(--font-heading)', letterSpacing: '-0.3px', marginBottom: '6px' }}>{tA("reachTitle")}</h2>
            <p style={{ fontSize: '13px', color: 'var(--fg-2)', marginBottom: '18px', lineHeight: '1.5' }}>{tA("reachDesc")}</p>

            <div className="field-row">
              <div className="field">
                <label>{tA("email")} <span className="req">*</span></label>
                <input type="email" placeholder={tA("emailPh")} />
              </div>
              <div className="field">
                <label>{tA("phone")} <span className="req">*</span></label>
                <div className="phone-grp">
                  <select defaultValue="🇸🇬 +65">
                    <option>🇸🇬 +65</option>
                    <option>🇲🇾 +60</option>
                    <option>🇮🇩 +62</option>
                  </select>
                  <input type="tel" placeholder={tA("phonePh")} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '8px' }}>
              <input type="checkbox" id="consent" defaultChecked style={{ height: '18px', width: '18px', marginTop: '2px' }}/>
              <label htmlFor="consent" style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--fg-2)', cursor: 'pointer' }}>
                {tA("consent", { country: countryName })}
              </label>
            </div>
          </section>

          {/* ============= STEP 3: CHECKOUT ============= */}
          <section className={`step step-pane${step === 3 ? " active" : ""}`} data-pane="3">
            <header className="step-head">
              <div className="step-eyebrow">{tA("stepOf", { n: 3 })}</div>
              <h1>{tA("s3Title")}</h1>
              <p>{tA("s3Desc")}</p>
            </header>

            <h2 className="checkout-h2">{tA("arrival", { country: countryName })}</h2>
            <div className="date-strip" id="dateStrip">
              {arrivalDates.map((d, i) => (
                <div
                  key={i}
                  className={`date-pill${i === selectedDate ? " active" : ""}`}
                  data-d={i}
                  onClick={() => setSelectedDate(i)}
                >
                  <div className="dow">{dayNames[d.getDay()]}</div>
                  <div className="day">{d.getDate()}</div>
                  <div className="mon">{monthNames[d.getMonth()]}</div>
                </div>
              ))}
            </div>

            <h2 className="checkout-h2">{tA("speed")}</h2>
            <div id="speedGroup">
              <div className={`upgrade${speed === "standard" ? " active" : ""}`} data-up="standard" data-group="speed" onClick={() => setSpeed("standard")}>
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <div className="txt"><div className="tt">{tA("stdTitle")}</div><div className="ts">{tA("stdSub")}</div></div>
                <div className="price"><span className="free">{tA("included")}</span></div>
                <div className="check"><CheckMark /></div>
              </div>
              <div className={`upgrade${speed === "express" ? " active" : ""}`} data-up="express" data-group="speed" onClick={() => setSpeed("express")}>
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
                <div className="txt"><div className="tt">{tA("expTitle")} <span className="recom">{tA("recommended")}</span></div><div className="ts">{tA("expSub")}</div></div>
                <div className="price">+ SGD 28</div>
                <div className="check"><CheckMark /></div>
              </div>
              <div className={`upgrade${speed === "superrush" ? " active" : ""}`} data-up="superrush" data-group="speed" onClick={() => setSpeed("superrush")}>
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg></div>
                <div className="txt"><div className="tt">{tA("rushTitle")}</div><div className="ts">{tA("rushSub")}</div></div>
                <div className="price">+ SGD 89</div>
                <div className="check"><CheckMark /></div>
              </div>
            </div>

            <h2 className="checkout-h2">{tA("addons")}</h2>
            <div>
              <div className={`upgrade${addons.insurance ? " active" : ""}`} data-up="insurance" onClick={() => toggleAddon("insurance")}>
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
                <div className="txt"><div className="tt">{tA("insTitle")}</div><div className="ts">{tA("insSub")}</div></div>
                <div className="price">+ SGD 32</div>
                <div className="check"><CheckMark /></div>
              </div>
              <div className={`upgrade${addons.esim ? " active" : ""}`} data-up="esim" onClick={() => toggleAddon("esim")}>
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/></svg></div>
                <div className="txt"><div className="tt">{tA("esimTitle", { country: countryName })}</div><div className="ts">{tA("esimSub")}</div></div>
                <div className="price">+ SGD 12</div>
                <div className="check"><CheckMark /></div>
              </div>
            </div>

            <div className="info-strip">
              <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div><strong>{tA("headsUp")}</strong> {tA("headsUpBody", { country: countryName })}</div>
            </div>

            <h2 className="checkout-h2">{tA("payTitle")}</h2>
            <p style={{ fontSize: '13px', color: 'var(--fg-2)', margin: '-8px 0 14px', lineHeight: '1.5' }}>
              {tA("paySub")}
            </p>
            <div style={{ display: 'grid', gap: '10px', maxWidth: '420px' }}>
              <PayByCardButton country={country.portalCountry} visaType={country.visaType} />
              <WechatPayButton country={country.portalCountry} visaType={country.visaType} />
            </div>
          </section>

        </main>

        <aside className="summary">
          <div className="sum-title">{tA("yourApp")}</div>
          <div className="sum-country">
            <div className="flag"><CircleFlag countryCode={country.flagCode} height={40}/></div>
            <div>
              <div className="nm">{countryName}</div>
              <div className="vt">{country.type} · {country.validity}</div>
            </div>
          </div>

          <div className="sum-eta">
            <div className="lab">{tA("guaranteedBy")}</div>
            <div className="val" id="sumEta">{sumEta}</div>
            <div className="sub"><span className="dot"></span> {tA("onTimeRefund")}</div>
          </div>

          <div className="price-row"><span className="k">{tA("govFee")}</span><span className="v">SGD 50.00</span></div>
          <div className="price-row"><span className="k">{tA("vizaProcessing")}</span><span className="v">SGD 32.00</span></div>
          <div className="price-row" id="sumExpressRow">
            <span className="k">{upgradeParts.length ? upgradeParts.join(" + ") : tA("upgrades")}</span>
            <span className="v">{upgradeParts.length ? tA("upgradeAmount", { amount: (speedAdd + addonsAdd).toFixed(2) }) : "—"}</span>
          </div>
          <div className="price-row discount"><span className="k">{tA("firstDiscount")}</span><span className="v">−SGD 10.00</span></div>

          <div className="price-total">
            <span className="k">{tA("total")}</span>
            <span className="v" id="sumTotal">{tA("totalAmount", { amount: total.toFixed(2) })}</span>
          </div>

          <div className="price-foot">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto', marginTop: '1px' }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>{tA("footEncrypted", { country: countryName })}</span>
          </div>
        </aside>

      </div>

      <div className="help-bubble" id="helpBubble" onClick={() => alert(tA("helpAlert"))}>
        <img src="https://i.pravatar.cc/64?img=47" alt=""/>
        <div>
          <div className="ht">{tA("helpOnline")}</div>
          <div className="hs">{tA("helpTap")}</div>
        </div>
        <span className="pulse"></span>
      </div>

      <div className="actions">
        <div className="actions-inner">
          <div className="actions-meta">
            <span id="actMeta">{`${tA("stepOf", { n: step })} · ${stepNames[step]}`}</span>
          </div>
          <div className="actions-buttons">
            <button
              className="btn-back"
              id="btnBack"
              type="button"
              style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
              onClick={onBack}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {tA("back")}
            </button>
            <button
              className="btn-next"
              id="btnNext"
              type="button"
              disabled={!canProceed}
              style={{ display: step === 3 ? 'none' : undefined }}
              onClick={onNext}
            >
              <span id="btnNextLabel">{nextLabel}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      <footer className="site-foot" data-screen-label="Footer">
        <div className="foot-rule"></div>

        <div className="foot-main">
          <div className="foot-brand">
            <a className="foot-logo" href="/"><img src="/assets/viza-logo-black.svg" alt="VIZA"/></a>
            <p className="foot-tag">{tF("tagline")}</p>

            <div className="ask-ai">{tF("askAi")}</div>
            <div className="ai-chips">
              <button className="ai-chip c1" type="button" title={tF("askAi")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </button>
              <button className="ai-chip c2" type="button" title={tF("askAi")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
              </button>
              <button className="ai-chip c3" type="button" title={tF("askAi")}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 13.8 8.4 20 10.5 13.8 12.6 12 19 10.2 12.6 4 10.5 10.2 8.4 12 2Z"/></svg>
              </button>
              <button className="ai-chip c4" type="button" title={tF("askAi")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
              </button>
            </div>
          </div>

          <div className="col-company">
            <h4 className="col-head">{tF("company")}</h4>
            <ul className="col-list">
              <li><a href="/careers">{tF("careers")}</a></li>
              <li><a href="/contact">{tF("contact")}</a></li>
              <li><a href="/security">{tF("security")}</a></li>
              <li><a href="/refunds">{tF("refundsPolicy")}</a></li>
              <li><a href="/status">{tF("status")}</a></li>
              <li><a href="/legal/privacy">{tF("privacy")}</a></li>
              <li><a href="/legal/terms">{tF("terms")}</a></li>
            </ul>
          </div>

          <div className="col-products">
            <h4 className="col-head">{tF("product")}</h4>
            <ul className="col-list">
              <li><a href="#">{tF("prodMockInterview")}</a></li>
              <li><a href="#">{tF("prodVisaReq")}</a></li>
              <li><a href="#">{tF("prodSchengen")}</a></li>
              <li><a href="#">{tF("prodPhoto")}</a></li>
              <li><a href="#">{tF("prodHelpline")}</a></li>
              <li><a href="#">{tF("prodStudent")}</a></li>
            </ul>
          </div>

          <div className="col-offices">
            <h4 className="col-head">{tF("offices")}</h4>
            <ul className="col-list">
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>1 Marina Boulevard, #20-01,<br/>Singapore 018989</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>301 Mission Street, San Francisco,<br/>CA 94105, USA</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>M16 — Al Makateb Building,<br/>Al Quoz 3, Sheikh Zayed Rd, Dubai</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>Suite 203, Davina House,<br/>137-149 Goswell Road, London EC1V 7ET</span>
              </li>
            </ul>
          </div>

          <div className="foot-apps">
            <a className="app-badge" href="#" aria-label="Download VIZA on the App Store">
              <img src="/assets/app-store-badge.png" alt="Download on the App Store"/>
            </a>
            <a className="app-badge" href="#" aria-label="Get VIZA on Google Play">
              <img src="/assets/google-play-badge.png" alt="Get it on Google Play"/>
            </a>
          </div>
        </div>

        <div className="foot-rule"></div>

        <div className="foot-bottom">
          <div className="legal">
            <span>{tF("copyright")}</span>
            <span className="sep"></span>
            <a href="#">{tF("privacy")}</a>
            <span className="sep"></span>
            <a href="#">{tF("terms")}</a>
          </div>
          <div className="foot-mark">
            <img src="/assets/viza-logo-black.svg" alt="VIZA"/>
          </div>
        </div>
      </footer>
    </>
  );
}

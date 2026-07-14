"use client";
import "./apply.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleFlag } from "react-circle-flags";
import SiteNav from "@/components/SiteNav";
import { PayByCardButton } from "@/components/PayByCardButton";
import { WechatPayButton } from "@/components/WechatPayButton";
import { countryBySlug } from "@/lib/countries";
import SiteFooter from "@/components/SiteFooter";

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

/**
 * The six identity fields the visitor must confirm before checkout. Every
 * one is required — extraction may leave any of them empty (partial read),
 * in which case the field opens in edit mode and blocks step 2 → 3.
 */
type PassportField =
  | "surname"
  | "givenNames"
  | "passportNumber"
  | "dob"
  | "nationality"
  | "expiryDate";

const REQUIRED_PASSPORT_FIELDS: PassportField[] = [
  "surname",
  "givenNames",
  "passportNumber",
  "dob",
  "nationality",
  "expiryDate",
];

const EMPTY_FIELDS: Record<PassportField, string> = {
  surname: "",
  givenNames: "",
  passportNumber: "",
  dob: "",
  nationality: "",
  expiryDate: "",
};

/** Recognition result: fully read vs. readable-but-incomplete. */
type ScanOutcome = "success" | "partial";

/** Terminal scan failures that keep the visitor on step 1 with a retry. */
type ScanFailure = "notPassport" | "unreadable" | "network";

/** Backend warning codes we can explain to the visitor. */
const KNOWN_WARNINGS = ["expired", "unreadable_mrz", "photo_too_blurry"] as const;
type KnownWarning = (typeof KNOWN_WARNINGS)[number];

type Step = 1 | 2 | 3;
type Speed = "standard" | "express" | "superrush";
type Addon = "insurance" | "esim";

// Base price: government fee (50) + VIZA processing (32) − first-time discount (10).
const BASE_PRICE = 50 + 32 - 10;
const SPEED_PRICE: Record<Speed, number> = { standard: 0, express: 28, superrush: 89 };
const ADDON_PRICE: Record<Addon, number> = { insurance: 32, esim: 12 };

const TEST_CHECKOUT_VISA_TYPE = "TEST_CHECKOUT";
const TEST_CHECKOUT_TOTAL_SGD = 1;
const TEST_CHECKOUT_PASSPORT: PassportExtraction = {
  surname: "ZHANG",
  givenNames: "EDWARD TEST",
  dob: "1990-01-01",
  sex: "Male",
  nationality: "SGP",
  passportNumber: "TEST0001",
  issuingCountry: "SGP",
  issueDate: "2026-01-01",
  expiryDate: "2036-01-01",
  confidence: "high",
};

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

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
);

/**
 * One cell of the passport review card. Displays the extracted value with a
 * hover pencil; clicking the pencil (or being flagged missing after a
 * partial scan) swaps the value for an inline input/select. Missing fields
 * are highlighted and block the continue-to-checkout action.
 */
function ReviewField({
  label,
  value,
  display,
  editing,
  invalid,
  requiredMsg,
  editLabel,
  type = "text",
  options,
  onEdit,
  onChange,
  onDone,
}: {
  label: string;
  value: string;
  display: React.ReactNode;
  editing: boolean;
  invalid: boolean;
  requiredMsg: string;
  editLabel: string;
  type?: "text" | "date" | "select";
  options?: { value: string; label: string }[];
  onEdit: () => void;
  onChange: (v: string) => void;
  onDone: () => void;
}) {
  return (
    <div className={`review-field${invalid ? " missing" : ""}`}>
      <div className="k">{label}</div>
      {editing ? (
        <div className="v">
          {type === "select" ? (
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onDone}
              aria-label={label}
            >
              <option value="">—</option>
              {options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onDone}
              onKeyDown={(e) => { if (e.key === "Enter") onDone(); }}
              aria-label={label}
            />
          )}
        </div>
      ) : (
        <>
          <div className="v">{display}</div>
          <button className="edit" type="button" aria-label={editLabel} onClick={onEdit}>
            <PencilIcon />
          </button>
        </>
      )}
      {invalid && !editing && <div className="req-note">{requiredMsg}</div>}
    </div>
  );
}

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
  const isTestCheckout = country.visaType === TEST_CHECKOUT_VISA_TYPE;

  const locale = useLocale();
  const tA = useTranslations("apply");
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
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome | null>(null);
  const [scanFailure, setScanFailure] = useState<ScanFailure | null>(null);
  const [scanFailureDetail, setScanFailureDetail] = useState<string | null>(null);

  // Editable copy of the extraction — the review card writes here, so the
  // visitor can correct misreads and fill anything the scan missed.
  const [fields, setFields] = useState<Record<PassportField, string>>(EMPTY_FIELDS);
  const [editing, setEditing] = useState<Partial<Record<PassportField, boolean>>>({});

  useEffect(() => {
    if (!isTestCheckout) return;
    setExtracted(TEST_CHECKOUT_PASSPORT);
    setFields({
      surname: TEST_CHECKOUT_PASSPORT.surname,
      givenNames: TEST_CHECKOUT_PASSPORT.givenNames,
      passportNumber: TEST_CHECKOUT_PASSPORT.passportNumber,
      dob: TEST_CHECKOUT_PASSPORT.dob,
      nationality: TEST_CHECKOUT_PASSPORT.nationality,
      expiryDate: TEST_CHECKOUT_PASSPORT.expiryDate,
    });
    setEditing({});
    setScanOutcome("success");
    setScanFailure(null);
    setExtractStage("done");
    setSpeed("standard");
    setAddons({ insurance: false, esim: false });
  }, [isTestCheckout]);

  // Contact details (step 2) — required before checkout.
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dialCode, setDialCode] = useState("+65");
  const [consent, setConsent] = useState(true);
  const [triedContinue, setTriedContinue] = useState(false);

  const setField = useCallback((f: PassportField, value: string) => {
    setFields((prev) => ({ ...prev, [f]: value }));
  }, []);

  const runExtraction = useCallback(async (file: File) => {
    if (!file) return;
    setExtracted(null);
    setScanOutcome(null);
    setScanFailure(null);
    setScanFailureDetail(null);
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

      // ---- Outcome classification ----
      const warnings = data.warnings ?? [];
      if (warnings.includes("not_a_passport")) {
        setScanFailure("notPassport");
        setExtractStage("idle");
        return;
      }

      const nextFields: Record<PassportField, string> = {
        surname: data.surname ?? "",
        givenNames: data.givenNames ?? "",
        passportNumber: data.passportNumber ?? "",
        dob: data.dob ?? "",
        nationality: data.nationality ?? "",
        expiryDate: data.expiryDate ?? "",
      };
      const missing = REQUIRED_PASSPORT_FIELDS.filter((f) => !nextFields[f].trim());

      // Nothing usable came back — treat as a failed scan, not a partial one.
      if (missing.length === REQUIRED_PASSPORT_FIELDS.length) {
        setScanFailure("unreadable");
        setExtractStage("idle");
        return;
      }

      const outcome: ScanOutcome =
        missing.length > 0 || data.confidence !== "high" || warnings.length > 0
          ? "partial"
          : "success";

      setExtractStage("verifying");
      // Brief verifying stage so users see the third checkmark animate in
      // before the page jumps to step 2.
      await new Promise((r) => setTimeout(r, 600));

      setExtracted(data);
      setFields(nextFields);
      // Missing fields open in edit mode so the visitor lands straight on
      // "complete these" rather than a wall of em-dashes.
      setEditing(Object.fromEntries(missing.map((f) => [f, true])));
      setScanOutcome(outcome);
      setTriedContinue(false);
      setExtractStage("done");

      try {
        sessionStorage.setItem("viza.passport.extracted", JSON.stringify(data));
      } catch {
        // sessionStorage may be blocked (private mode, etc.) — non-fatal.
      }

      setTimeout(() => goStep(2), 400);
    } catch (err) {
      setScanFailure("network");
      setScanFailureDetail(err instanceof Error ? err.message : String(err));
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  // -------------- DERIVED PRICING / SUMMARY --------------
  const summaryGovFee = isTestCheckout ? 0 : 50;
  const summaryVizaFee = isTestCheckout ? TEST_CHECKOUT_TOTAL_SGD : 32;
  const summaryDiscount = isTestCheckout ? 0 : 10;
  const speedAdd = isTestCheckout ? 0 : SPEED_PRICE[speed];
  const addonsAdd = isTestCheckout ? 0 : (addons.insurance ? ADDON_PRICE.insurance : 0) + (addons.esim ? ADDON_PRICE.esim : 0);
  const total = summaryGovFee + summaryVizaFee - summaryDiscount + speedAdd + addonsAdd;

  const upgradeParts: string[] = [];
  if (!isTestCheckout && speed !== "standard") upgradeParts.push(speed === "express" ? tA("express") : tA("superRush"));
  if (!isTestCheckout && addons.insurance) upgradeParts.push(tA("insurance"));
  if (!isTestCheckout && addons.esim) upgradeParts.push(tA("esim"));

  const sumEta =
    speed === "standard" ? tA("etaStandard") :
    speed === "superrush" ? tA("etaSuperrush") :
    tA("etaExpress");

  // -------------- DERIVED EXTRACTION VIEW STATE --------------
  const isUploading = !isTestCheckout && extractStage !== "idle";
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

  const canProceed = (step === 1 && isTestCheckout) || step === 2 || step === 3;

  // -------------- STEP 2 VALIDATION --------------
  const missingFields = useMemo(
    () => REQUIRED_PASSPORT_FIELDS.filter((f) => !fields[f].trim()),
    [fields],
  );
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneValid = phone.replace(/\D/g, "").length >= 5;
  const step2Valid = missingFields.length === 0 && emailValid && phoneValid && consent;

  const fullName = `${fields.givenNames} ${fields.surname}`.trim();

  // Wizard payload for the portal checkout: everything the visitor gave us
  // (passport OCR + corrections, phone, arrival date, tier, add-ons),
  // base64url-encoded so it survives as one opaque query param. The portal
  // decodes and persists it server-side (lib/checkout/prefill.ts) so the
  // OCR work isn't thrown away at the payment hand-off.
  const checkoutPrefill = useMemo(() => {
    const arrival = arrivalDates[selectedDate];
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const payload = {
      surname: fields.surname || undefined,
      givenNames: fields.givenNames || undefined,
      passportNumber: fields.passportNumber || undefined,
      dob: fields.dob || undefined,
      nationality: fields.nationality || undefined,
      expiryDate: fields.expiryDate || undefined,
      issueDate: extracted?.issueDate || undefined,
      issuingCountry: extracted?.issuingCountry || undefined,
      sex: extracted?.sex || undefined,
      phone: phone.trim() ? `${dialCode} ${phone.trim()}` : undefined,
      arrivalDate: arrival ? iso(arrival) : undefined,
      speed,
      addons: (Object.keys(addons) as Addon[]).filter((a) => addons[a]),
    };
    try {
      const json = JSON.stringify(payload);
      // UTF-8-safe base64url (btoa alone chokes on non-Latin-1 names).
      const bytes = new TextEncoder().encode(json);
      let bin = "";
      bytes.forEach((b) => { bin += String.fromCharCode(b); });
      return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    } catch {
      return undefined;
    }
  }, [fields, extracted, phone, dialCode, arrivalDates, selectedDate, speed, addons]);

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
    if (step === 1 && isTestCheckout) {
      goStep(2);
      return;
    }
    // Step 3 is the checkout step — payment method (card / WeChat) is chosen
    // via the inline buttons that deep-link to the portal checkout, so the
    // bottom Next button does nothing here (it is also hidden).
    if (step === 3) return;
    if (step === 2) {
      if (!step2Valid) {
        // Surface what's blocking: open every missing passport field in edit
        // mode and switch the inline validation messages on.
        setTriedContinue(true);
        setEditing((prev) => ({
          ...prev,
          ...Object.fromEntries(missingFields.map((f) => [f, true])),
        }));
        return;
      }
      try {
        sessionStorage.setItem(
          "viza.passport.extracted",
          JSON.stringify({ ...extracted, ...fields }),
        );
        sessionStorage.setItem(
          "viza.apply.contact",
          JSON.stringify({ email: email.trim(), phone: `${dialCode} ${phone.trim()}` }),
        );
      } catch {
        // sessionStorage may be blocked — non-fatal.
      }
    }
    goStep((step + 1) as Step);
  }, [canProceed, step, isTestCheckout, goStep, step2Valid, missingFields, extracted, fields, email, dialCode, phone]);

  const showWarning = scanOutcome === "partial";
  const knownWarnings = (extracted?.warnings ?? []).filter((w): w is KnownWarning =>
    (KNOWN_WARNINGS as readonly string[]).includes(w),
  );

  // -------------- REVIEW CARD CONFIG --------------
  const nationalityOptions = useMemo(() => {
    const opts = Object.entries(COUNTRY_MAP)
      .map(([a3, v]) => ({ value: a3, label: v.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
    // Preserve an extracted alpha-3 we don't have a friendly name for.
    const current = fields.nationality.toUpperCase();
    if (current && !COUNTRY_MAP[current]) {
      opts.push({ value: fields.nationality, label: fields.nationality });
    }
    return opts;
  }, [fields.nationality]);

  const reviewFieldDefs: {
    f: PassportField;
    label: string;
    type?: "text" | "date" | "select";
    display: React.ReactNode;
  }[] = [
    { f: "surname", label: tA("fSurname"), display: fields.surname || "—" },
    { f: "givenNames", label: tA("fGiven"), display: fields.givenNames || "—" },
    { f: "passportNumber", label: tA("fPassport"), display: fields.passportNumber || "—" },
    { f: "dob", label: tA("fDob"), type: "date", display: formatDateDisplay(fields.dob) },
    {
      f: "nationality",
      label: tA("fNationality"),
      type: "select",
      display: fields.nationality ? <CountryDisplay alpha3={fields.nationality} /> : "—",
    },
    { f: "expiryDate", label: tA("fExpires"), type: "date", display: formatDateDisplay(fields.expiryDate) },
  ];

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

            {/* Hidden file input — clicked via dropzone. In "Take photo"
                mode the capture hint opens the camera directly on mobile. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture={uploadMode === "capture" ? "environment" : undefined}
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

                {scanFailure && (
                  <div className="scan-failed" role="alert">
                    <div className="sf-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </div>
                    <div className="sf-body">
                      <div className="sf-title">{tA("failTitle")}</div>
                      <div className="sf-text">
                        {scanFailure === "notPassport" && tA("failNotPassport")}
                        {scanFailure === "unreadable" && tA("failUnreadable")}
                        {scanFailure === "network" && tA("errReadFail", { detail: scanFailureDetail ?? "" })}
                      </div>
                      <button
                        className="sf-retry"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {tA("tryAgain")}
                      </button>
                    </div>
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
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 6,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  {missingFields.length > 0
                    ? tA("warnPartial")
                    : extracted.confidence === "low"
                      ? tA("warnLow")
                      : tA("warnMed")}
                </span>
                {knownWarnings.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 26, font: "400 12px/1.6 var(--font-sans)" }}>
                    {knownWarnings.map((w) => (
                      <li key={w}>
                        {w === "expired" && tA("warnExpired")}
                        {w === "unreadable_mrz" && tA("warnMrz")}
                        {w === "photo_too_blurry" && tA("warnBlurry")}
                      </li>
                    ))}
                  </ul>
                )}
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
                {reviewFieldDefs.map(({ f, label, type, display }) => (
                  <ReviewField
                    key={f}
                    label={label}
                    value={fields[f]}
                    display={display}
                    type={type}
                    options={f === "nationality" ? nationalityOptions : undefined}
                    editing={!!editing[f]}
                    invalid={!fields[f].trim()}
                    requiredMsg={tA("fieldRequired")}
                    editLabel={tA("editField", { field: label })}
                    onEdit={() => setEditing((prev) => ({ ...prev, [f]: true }))}
                    onChange={(v) => setField(f, v)}
                    onDone={() => setEditing((prev) => ({ ...prev, [f]: false }))}
                  />
                ))}
              </div>
            </div>

            <h2 style={{ font: '500 18px/1.2 var(--font-heading)', letterSpacing: '-0.3px', marginBottom: '6px' }}>{tA("reachTitle")}</h2>
            <p style={{ fontSize: '13px', color: 'var(--fg-2)', marginBottom: '18px', lineHeight: '1.5' }}>{tA("reachDesc")}</p>

            <div className="field-row">
              <div className="field">
                <label htmlFor="applyEmail">{tA("email")} <span className="req">*</span></label>
                <input
                  id="applyEmail"
                  type="email"
                  placeholder={tA("emailPh")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={triedContinue && !emailValid ? "invalid" : undefined}
                />
                {triedContinue && !emailValid && (
                  <div className="req-note">{tA("emailInvalid")}</div>
                )}
              </div>
              <div className="field">
                <label htmlFor="applyPhone">{tA("phone")} <span className="req">*</span></label>
                <div className="phone-grp">
                  <select
                    value={dialCode}
                    onChange={(e) => setDialCode(e.target.value)}
                    aria-label={tA("phone")}
                  >
                    <option value="+65">🇸🇬 +65</option>
                    <option value="+60">🇲🇾 +60</option>
                    <option value="+62">🇮🇩 +62</option>
                    <option value="+86">🇨🇳 +86</option>
                    <option value="+852">🇭🇰 +852</option>
                    <option value="+886">🇹🇼 +886</option>
                  </select>
                  <input
                    id="applyPhone"
                    type="tel"
                    placeholder={tA("phonePh")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={triedContinue && !phoneValid ? "invalid" : undefined}
                  />
                </div>
                {triedContinue && !phoneValid && (
                  <div className="req-note">{tA("phoneInvalid")}</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '8px' }}>
              <input
                type="checkbox"
                id="consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ height: '18px', width: '18px', marginTop: '2px' }}
              />
              <label htmlFor="consent" style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--fg-2)', cursor: 'pointer' }}>
                {tA("consent", { country: countryName })}
              </label>
            </div>
            {triedContinue && !consent && (
              <div className="req-note" style={{ marginTop: 6 }}>{tA("consentRequired")}</div>
            )}
            {triedContinue && !step2Valid && (
              <div
                role="alert"
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  color: "#92400e",
                  font: "500 13px/1.45 var(--font-sans)",
                }}
              >
                {tA("completeBeforeCheckout")}
              </div>
            )}
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
              <PayByCardButton
                country={country.portalCountry}
                visaType={country.visaType}
                email={email.trim() || undefined}
                fullName={fullName || undefined}
                prefill={checkoutPrefill}
              />
              <WechatPayButton
                country={country.portalCountry}
                visaType={country.visaType}
                email={email.trim() || undefined}
                fullName={fullName || undefined}
                prefill={checkoutPrefill}
              />
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

          <div className="price-row"><span className="k">{tA("govFee")}</span><span className="v">{tA("totalAmount", { amount: summaryGovFee.toFixed(2) })}</span></div>
          <div className="price-row"><span className="k">{tA("vizaProcessing")}</span><span className="v">{tA("totalAmount", { amount: summaryVizaFee.toFixed(2) })}</span></div>
          <div className="price-row" id="sumExpressRow">
            <span className="k">{upgradeParts.length ? upgradeParts.join(" + ") : tA("upgrades")}</span>
            <span className="v">{upgradeParts.length ? tA("upgradeAmount", { amount: (speedAdd + addonsAdd).toFixed(2) }) : "—"}</span>
          </div>
          {summaryDiscount > 0 && (
            <div className="price-row discount"><span className="k">{tA("firstDiscount")}</span><span className="v">−{tA("totalAmount", { amount: summaryDiscount.toFixed(2) })}</span></div>
          )}

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

      <a className="help-bubble" id="helpBubble" href="/contact">
        <img src="https://i.pravatar.cc/64?img=47" alt=""/>
        <div>
          <div className="ht">{tA("helpOnline")}</div>
          <div className="hs">{tA("helpTap")}</div>
        </div>
        <span className="pulse"></span>
      </a>

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

      <SiteFooter />
    </>
  );
}

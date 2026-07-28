import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFDocument, type PDFForm } from "pdf-lib";

import { mofaCountryLabel } from "./country-codes";

/**
 * Render a filled MOFA "Application for Visa" Form A PDF from VIZA's
 * visa_application_answers map for a JP_TOURIST package.
 *
 * The MOFA template is the official AcroForm-bearing PDF published at
 * https://www.mofa.go.jp/files/000124525.pdf, vendored into
 * `lib/jp-tourist/templates/mofa-form-a.pdf`. Every form field maps to a
 * VIZA `field_name` from `seed-jp-tourist-form-fields.ts` via the inline
 * mapping in {@link fillForm}. Unmappable form fields (e.g. Certificate of
 * Eligibility No., spouse name/DOB which the form doesn't have but the
 * schema does) are either left blank or routed into the remarks block.
 */

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "lib/jp-tourist/templates/mofa-form-a.pdf",
);

export type AnswerMap = Record<string, string | null | undefined>;

export interface RenderOptions {
  /** When true, flatten the form so the output is non-editable. */
  flatten?: boolean;
}

/**
 * Map a VIZA `marital_status` value to the MOFA RB2 export value.
 *
 * MOFA's RB2 widget order is Single/Married/Widowed/Divorced (left to
 * right), but the AcroForm export values are 1/2/4/3 in that visual order.
 */
const MARITAL_STATUS_MAP: Record<string, string> = {
  single: "1",
  married: "2",
  widowed: "4",
  divorced: "3",
};

/**
 * Map a VIZA `passport_type` value to the MOFA RB3 export value.
 *
 * MOFA RB3 visual order: Diplomatic/Official/Ordinary/Other → exports
 * 2/3/1/4 in that visual order.
 */
const PASSPORT_TYPE_MAP: Record<string, string> = {
  ordinary: "1",
  diplomatic: "2",
  official: "3",
  other: "4",
};

const SEX_MAP: Record<string, string> = {
  male: "M",
  female: "F",
};

/**
 * Render the MOFA Form A PDF from a flat answer map.
 *
 * The function is pure aside from reading the bundled template — pass it
 * the same answer map you would persist via `visa_application_answers` and
 * it returns the filled PDF as a `Uint8Array`. Empty / missing answers are
 * left blank (no guesses).
 */
export async function renderJpTouristFormA(
  answers: AnswerMap,
  options: RenderOptions = {},
): Promise<Uint8Array> {
  const templateBytes = await fs.readFile(TEMPLATE_PATH);
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();

  fillForm(form, answers);

  if (options.flatten) {
    form.flatten();
  }

  return pdf.save();
}

function fillForm(form: PDFForm, answers: AnswerMap): void {
  // ── Helpers ──────────────────────────────────────────────────────────
  const setText = (mofaName: string, value: string | null | undefined) => {
    if (value == null || value === "") return;
    try {
      const field = form.getTextField(mofaName);
      const max = field.getMaxLength();
      const sanitized = sanitizeForWinAnsi(value);
      const str = max != null ? sanitized.slice(0, max) : sanitized;
      field.setText(str);
    } catch (err) {
      console.warn(`[jp-tourist] setText failed: ${mofaName}: ${(err as Error).message}`);
    }
  };

  const setRadio = (mofaName: string, exportValue: string | null | undefined) => {
    if (exportValue == null || exportValue === "") return;
    try {
      const field = form.getRadioGroup(mofaName);
      const opts = field.getOptions();
      const match = opts.find((o) => o.trim() === exportValue.trim());
      field.select(match ?? exportValue);
    } catch (err) {
      console.warn(`[jp-tourist] setRadio failed: ${mofaName}: ${(err as Error).message}`);
    }
  };

  const setDropdown = (mofaName: string, countryName: string | null | undefined) => {
    if (!countryName) return;
    try {
      const field = form.getDropdown(mofaName);
      const opts = field.getOptions();
      const label = mofaCountryLabel(countryName, opts);
      if (label) field.select(label);
      else console.warn(`[jp-tourist] dropdown ${mofaName}: no MOFA label for "${countryName}"`);
    } catch (err) {
      console.warn(`[jp-tourist] setDropdown failed: ${mofaName}: ${(err as Error).message}`);
    }
  };

  const a = (key: string): string => (answers[key] ?? "").toString().trim();

  // ── Page 1: Personal Information ─────────────────────────────────────
  setText("topmostSubform[0].Page1[0].T2[0]", a("surname"));
  setText("topmostSubform[0].Page1[0].T7[0]", a("given_names"));
  setText("topmostSubform[0].Page1[0].T16[1]", a("other_names_used"));
  setText("topmostSubform[0].Page1[0].#area[4].T14[0]", a("date_of_birth"));
  // Place of birth: City  State  Country combined into one wide field.
  const pob = [a("place_of_birth_city"), a("place_of_birth_state"), a("place_of_birth_country")]
    .filter(Boolean)
    .join("  ");
  setText("topmostSubform[0].Page1[0].#area[4].T16[0]", pob);

  setRadio("topmostSubform[0].Page1[0].#area[5].#area[6].#area[7].RB1[0]", SEX_MAP[a("sex")]);
  setRadio("topmostSubform[0].Page1[0].#area[8].RB2[0]", MARITAL_STATUS_MAP[a("marital_status")]);

  setDropdown("topmostSubform[0].Page1[0].T50[0]", a("nationality"));
  setDropdown("topmostSubform[0].Page1[0].T34[0]", a("other_nationality"));

  setText("topmostSubform[0].Page1[0].T37[0]", a("id_card_number"));

  // ── Page 1: Passport ─────────────────────────────────────────────────
  setRadio(
    "topmostSubform[0].Page1[0].#area[1].#area[2].RB3[0]",
    PASSPORT_TYPE_MAP[a("passport_type")],
  );
  setText("topmostSubform[0].Page1[0].T49[0]", a("passport_number"));
  setText("topmostSubform[0].Page1[0].#area[9].T57[1]", a("passport_place_of_issue"));
  setText("topmostSubform[0].Page1[0].#area[9].T53[0]", a("passport_issue_date"));
  setText("topmostSubform[0].Page1[0].#area[0].T57[0]", a("passport_issuing_authority"));
  setText("topmostSubform[0].Page1[0].#area[0].T59[0]", a("passport_expiry_date"));

  // ── Page 1: Trip Details ─────────────────────────────────────────────
  // Purpose is locked to Tourism by the schema; render the literal label.
  setText("topmostSubform[0].Page1[0].T68[2]", "Tourism (Short-Term Stay)");
  setText("topmostSubform[0].Page1[0].T66[0]", a("intended_arrival_date"));
  setText(
    "topmostSubform[0].Page1[0].T68[3]",
    a("intended_length_of_stay") ? `${a("intended_length_of_stay")} days` : "",
  );
  setText("topmostSubform[0].Page1[0].#area[10].T68[0]", a("port_of_entry"));
  setText("topmostSubform[0].Page1[0].#area[10].T68[1]", a("carrier_name"));
  setText(
    "topmostSubform[0].Page1[0].#area[12].emp_name[1]",
    a("accommodation_name"),
  );
  setText("topmostSubform[0].Page1[0].emp_adr[1]", a("accommodation_address"));
  setText(
    "topmostSubform[0].Page1[0].#area[12].emp_tel[1]",
    a("accommodation_phone"),
  );
  setText("topmostSubform[0].Page1[0].T64[0]", joinPriorJapanVisits(answers));

  // ── Page 1: Contact & Home Address ───────────────────────────────────
  const home = [a("home_address_line1"), a("home_address_city"), a("home_address_country")]
    .filter(Boolean)
    .join(", ");
  setText("topmostSubform[0].Page1[0].T0[1]", home);
  setText("topmostSubform[0].Page1[0].#area[11].T97[0]", a("telephone_number"));
  setText("topmostSubform[0].Page1[0].#area[11].T3[0]", a("mobile_number"));
  setText("topmostSubform[0].Page1[0].T3[1]", a("email_address"));

  // ── Page 1: Occupation ───────────────────────────────────────────────
  const occupation = [a("current_profession"), a("position_title")]
    .filter(Boolean)
    .join(" / ");
  setText("topmostSubform[0].Page1[0].T5[0]", occupation);
  setText(
    "topmostSubform[0].Page1[0].#area[3].emp_name[0]",
    a("employer_or_school_name"),
  );
  setText(
    "topmostSubform[0].Page1[0].emp_adr[0]",
    a("employer_or_school_address"),
  );
  setText(
    "topmostSubform[0].Page1[0].#area[3].emp_tel[0]",
    a("employer_or_school_phone"),
  );

  // ── Page 2: Inviter / Guarantor in Japan ─────────────────────────────
  // The schema captures one inviter block. The form has two parallel blocks
  // (Guarantor + Inviter). Most cases are the same person — render into the
  // Guarantor block (top) and write "Same as above" in the Inviter block.
  if (a("has_inviter_in_japan") === "yes") {
    setText(
      "topmostSubform[0].Page2[0].#area[0].guarantor_name[0]",
      a("inviter_full_name"),
    );
    setText("topmostSubform[0].Page2[0].guarantor_adr[0]", a("inviter_address"));
    setText(
      "topmostSubform[0].Page2[0].#area[0].guarantor_tel[0]",
      a("inviter_phone"),
    );
    setText(
      "topmostSubform[0].Page2[0].#area[3].T14[1]",
      a("inviter_date_of_birth"),
    );
    setRadio("topmostSubform[0].Page2[0].RB1[0]", SEX_MAP[a("inviter_sex")]);
    setText(
      "topmostSubform[0].Page2[0].T25[1]",
      a("inviter_relationship_to_applicant"),
    );
    setText("topmostSubform[0].Page2[0].T5[0]", a("inviter_occupation"));
    // MOFA T5[1] is "Nationality and immigration status" — combine.
    const guarantorStatus = [
      a("inviter_nationality"),
      a("inviter_immigration_status"),
    ]
      .filter(Boolean)
      .join(" / ");
    setText("topmostSubform[0].Page2[0].T5[1]", guarantorStatus);

    // Inviter block — mark same as above
    setText("topmostSubform[0].Page2[0].#area[2].T19[0]", "Same as above");
  }

  // ── Page 2: Partner's profession (item present, schema doesn't capture) ──
  // The form's only spouse-related field is partner profession. Schema has
  // spouse_full_name / spouse_dob / spouse_nationality but not occupation.
  // Leave T16[2] blank; route the spouse details into Remarks below.

  // ── Page 2: Character questions ──────────────────────────────────────
  // Mapping VIZA's 4 broader radios onto MOFA's 6 specific questions:
  //   has_criminal_record === yes  -> tick crime conviction (RB5[3])
  //   has_been_deported / has_overstayed_japan === yes -> tick deport (RB5[1])
  //   has_drug_or_trafficking_history === yes -> append note in T28[1] only
  //     (the form's drug / prostitution / trafficking radios stay un-ticked
  //      so the applicant can review and answer each specifically)
  if (a("has_criminal_record") === "yes") {
    setRadio("topmostSubform[0].Page2[0].#area[7].#area[8].RB5[3]", "Yes");
  }
  if (a("has_been_deported") === "yes" || a("has_overstayed_japan") === "yes") {
    setRadio("topmostSubform[0].Page2[0].#area[5].RB5[1]", "Yes");
  }

  // ── Page 2: Remarks (T28[0]) ────────────────────────────────────────
  const remarks = buildRemarks(answers);
  setText("topmostSubform[0].Page2[0].T28[0]", remarks);

  // ── Page 2: "If yes" details (T28[1]) ───────────────────────────────
  const yesDetails = buildYesDetails(answers);
  setText("topmostSubform[0].Page2[0].T28[1]", yesDetails);

  // ── Page 2: Date of application ─────────────────────────────────────
  setText("topmostSubform[0].Page2[0].T150[0]", a("application_date"));
}

/**
 * pdf-lib defaults to WinAnsi-encoded Helvetica for AcroForm text appearance,
 * which cannot encode characters outside Latin-1 (no CJK, no arrows like →).
 * This is a v1 limit — embedding a fontkit-backed TTF would solve it but
 * costs ~5MB of bundle. MOFA Form A is filled in English (romanized per
 * passport), so ASCII coverage is the realistic floor.
 *
 * The substitutions handle the most common drift (smart quotes, em/en dash,
 * arrows). Anything else outside U+0000..U+00FF is replaced with `?`.
 */
function sanitizeForWinAnsi(value: string): string {
  const replacements: Record<string, string> = {
    "→": " -> ",
    "←": " <- ",
    "—": " - ",
    "–": "-",
    "“": '"',
    "”": '"',
    "‘": "'",
    "’": "'",
    "…": "...",
    "•": "*",
    "·": ".",
  };
  let out = "";
  for (const ch of value) {
    if (replacements[ch]) {
      out += replacements[ch];
      continue;
    }
    const cp = ch.codePointAt(0) ?? 0;
    out += cp <= 0xff ? ch : "?";
  }
  return out;
}

/**
 * MOFA T64 ("Dates and duration of previous stays in Japan") has a
 * hard maxLength of 50 chars on the AcroForm widget. To stay within that
 * limit, this builder emits dates only (DD/MM/YYYY-DD/MM/YYYY pairs joined
 * by "; ") — fits two visits cleanly, three with truncation. Purposes for
 * each visit are routed into the remarks block so detail isn't lost.
 */
function joinPriorJapanVisits(answers: AnswerMap): string {
  const parts: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const suffix = i === 1 ? "" : `__${i}`;
    const arr = (answers[`prior_japan_visit_arrival_date${suffix}`] ?? "").toString().trim();
    const dep = (answers[`prior_japan_visit_departure_date${suffix}`] ?? "").toString().trim();
    if (!arr && !dep) continue;
    parts.push([arr, dep].filter(Boolean).join("-"));
  }
  return parts.join("; ");
}

function priorJapanVisitsRemarks(answers: AnswerMap): string {
  const lines: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const suffix = i === 1 ? "" : `__${i}`;
    const arr = (answers[`prior_japan_visit_arrival_date${suffix}`] ?? "").toString().trim();
    const dep = (answers[`prior_japan_visit_departure_date${suffix}`] ?? "").toString().trim();
    const purpose = (answers[`prior_japan_visit_purpose${suffix}`] ?? "").toString().trim();
    if (!arr && !dep && !purpose) continue;
    const dates = [arr, dep].filter(Boolean).join("-");
    const tail = purpose ? `(${purpose})` : "";
    lines.push([dates, tail].filter(Boolean).join(" "));
  }
  return lines.length ? `Prior Japan visits: ${lines.join("; ")}` : "";
}

function buildRemarks(answers: AnswerMap): string {
  const a = (k: string) => (answers[k] ?? "").toString().trim();
  const lines: string[] = [];

  if (a("marital_status") === "married" && (a("spouse_full_name") || a("spouse_date_of_birth") || a("spouse_nationality"))) {
    const spouse = [
      a("spouse_full_name") ? `Spouse: ${a("spouse_full_name")}` : "",
      a("spouse_date_of_birth") ? `DOB ${a("spouse_date_of_birth")}` : "",
      a("spouse_nationality") ? `Nationality ${a("spouse_nationality")}` : "",
    ].filter(Boolean).join("; ");
    if (spouse) lines.push(spouse);
  }

  // Other-nationalities / other-passports beyond the first instance won't
  // fit on the single MOFA Page1.T34 dropdown — list them here.
  const extraNats: string[] = [];
  for (let i = 2; i <= 3; i++) {
    const v = (answers[`other_nationality__${i}`] ?? "").toString().trim();
    if (v) extraNats.push(v);
  }
  if (extraNats.length) lines.push(`Other nationalities: ${extraNats.join(", ")}`);

  const otherPp: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const suffix = i === 1 ? "" : `__${i}`;
    const num = (answers[`other_passport_number${suffix}`] ?? "").toString().trim();
    const ctry = (answers[`other_passport_country${suffix}`] ?? "").toString().trim();
    if (num || ctry) otherPp.push([num, ctry].filter(Boolean).join(" / "));
  }
  if (otherPp.length) lines.push(`Other passports: ${otherPp.join("; ")}`);

  // Refusals
  if (a("refused_visa_or_entry_japan") === "yes" && a("refused_visa_japan_details")) {
    lines.push(`Prior Japan visa/entry refusal: ${a("refused_visa_japan_details")}`);
  }
  if (a("refused_visa_other_country") === "yes" && a("refused_visa_other_country_details")) {
    lines.push(`Prior other-country visa/entry refusal: ${a("refused_visa_other_country_details")}`);
  }

  // Visit purposes go here so the T64 dates-only fit within its maxLength=50.
  const visits = priorJapanVisitsRemarks(answers);
  if (visits) lines.push(visits);

  // Free-text remarks last
  if (a("remarks_special_circumstances")) lines.push(a("remarks_special_circumstances"));

  return lines.join(" | ");
}

function buildYesDetails(answers: AnswerMap): string {
  const a = (k: string) => (answers[k] ?? "").toString().trim();
  const parts: string[] = [];
  if (a("has_criminal_record") === "yes" && a("criminal_record_details")) {
    parts.push(`[Criminal record] ${a("criminal_record_details")}`);
  }
  if (a("has_been_deported") === "yes" && a("deportation_details")) {
    parts.push(`[Deported / removed] ${a("deportation_details")}`);
  }
  if (a("has_overstayed_japan") === "yes" && a("overstay_details")) {
    parts.push(`[Overstay in Japan] ${a("overstay_details")}`);
  }
  if (a("has_drug_or_trafficking_history") === "yes") {
    parts.push("[Drug / prostitution / trafficking — please review specific question above]");
  }
  return parts.join(" — ");
}

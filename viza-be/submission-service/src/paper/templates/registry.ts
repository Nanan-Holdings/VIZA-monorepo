/**
 * Paper-channel template registry (DOC-004).
 *
 * Each entry holds the layout for a country's printable paper-channel
 * application. The seedPaperTemplates() helper upserts these into the
 * `paper_template` table keyed by (package_id, key); the renderer at
 * `paper/renderer.ts` then picks them up to render the PDF.
 *
 * Registered countries (AUTO-T3 paper cohort): JP, KR, SG, HK, MO, PH (9a).
 */

import { supabase } from "../../supabase.js";
import type { PaperLayout } from "../renderer.js";

interface Entry {
  country: string;
  visa_type: string;
  key: string;
  title: string;
  layout: PaperLayout;
}

const COMMON_FIELDS: PaperLayout["fields"] = [
  { answerKey: "surname", label: "Surname", format: "uppercase" },
  { answerKey: "given_names", label: "Given Names", format: "uppercase" },
  { answerKey: "date_of_birth", label: "Date of Birth" },
  { answerKey: "nationality", label: "Nationality" },
  { answerKey: "passport_number", label: "Passport Number", format: "uppercase" },
  { answerKey: "passport_expiry_date", label: "Passport Expiry" },
  { answerKey: "passport_issuing_country", label: "Passport Issuing Country" },
  { answerKey: "email", label: "Email" },
  { answerKey: "phone", label: "Phone" },
  { answerKey: "intended_arrival_date", label: "Intended Arrival" },
  { answerKey: "intended_departure_date", label: "Intended Departure" },
  { answerKey: "visit_purpose", label: "Purpose of Visit" },
  { answerKey: "occupation", label: "Occupation" },
];

const ENTRIES: Entry[] = [
  {
    country: "japan",
    visa_type: "tourist_visa",
    key: "jp_form_a",
    title: "Application for Visa (Form A) — Embassy of Japan",
    layout: {
      fields: [
        ...COMMON_FIELDS,
        { answerKey: "guarantor_name", label: "Guarantor in Japan (name)" },
        { answerKey: "guarantor_phone", label: "Guarantor phone" },
        { answerKey: "accommodation_address", label: "Accommodation address" },
      ],
      footer: "Print on A4. Sign in black ink. Submit with passport + 1 photo (45×45mm).",
    },
  },
  {
    country: "korea",
    visa_type: "c_3_9",
    key: "kr_visa_application",
    title: "Application for Visa (C-3-9) — Republic of Korea",
    layout: {
      fields: [
        ...COMMON_FIELDS,
        { answerKey: "address_in_korea", label: "Address in Korea" },
        { answerKey: "korean_invitee_name", label: "Inviter / contact (if any)" },
      ],
      footer: "Submit at KVAC with passport, 1 photo (35×45mm), and travel itinerary.",
    },
  },
  {
    country: "singapore",
    visa_type: "visit_visa",
    key: "sg_form_14a",
    title: "Form 14A — Application for Visa (Singapore ICA)",
    layout: {
      fields: [
        ...COMMON_FIELDS,
        { answerKey: "local_contact_name", label: "Local contact in Singapore" },
        { answerKey: "local_contact_nric_or_fin", label: "Local contact NRIC/FIN" },
      ],
      footer: "Submitted via authorised visa agent (eVISA portal not available for this nationality).",
    },
  },
  {
    country: "hong_kong",
    visa_type: "visit_visa",
    key: "hk_id_1003a",
    title: "ID 1003A — Application for Hong Kong visit visa",
    layout: {
      fields: [
        ...COMMON_FIELDS,
        { answerKey: "local_sponsor_name", label: "Sponsor in Hong Kong" },
        { answerKey: "local_sponsor_address", label: "Sponsor address" },
      ],
      footer: "Submit to Immigration Department via post or HK consular post.",
    },
  },
  {
    country: "macau",
    visa_type: "visit_visa",
    key: "mo_dscv1",
    title: "DSCV-1 — Application for Macau visit visa",
    layout: {
      fields: COMMON_FIELDS,
      footer: "Submit to Macau Identification Services Bureau on arrival or via consular post.",
    },
  },
  {
    country: "philippines",
    visa_type: "9a_visa",
    key: "ph_9a_application",
    title: "Form 1 (9a) — Philippines temporary visitor visa",
    layout: {
      fields: [
        ...COMMON_FIELDS,
        { answerKey: "local_contact_name", label: "Local contact in the Philippines" },
        { answerKey: "local_contact_phone", label: "Local contact phone" },
      ],
      footer: "Submitted at PH consulate. eTravel registration is a separate online step.",
    },
  },
];

export const PAPER_TEMPLATE_KEYS = ENTRIES.map((e) => ({
  country: e.country,
  visa_type: e.visa_type,
  key: e.key,
}));

export async function seedPaperTemplates(): Promise<void> {
  for (const e of ENTRIES) {
    const { data: pkg } = await supabase
      .from("visa_packages")
      .select("id")
      .eq("country", e.country)
      .eq("visa_type", e.visa_type)
      .maybeSingle();
    if (!pkg) {
      console.warn(`[paper-templates] no visa_packages row for ${e.country}/${e.visa_type}; skipping ${e.key}`);
      continue;
    }
    const { error } = await supabase
      .from("paper_template")
      .upsert(
        {
          package_id: (pkg as { id: string }).id,
          key: e.key,
          title: e.title,
          layout: e.layout,
        },
        { onConflict: "package_id,key" },
      );
    if (error) {
      console.error(`[paper-templates] upsert ${e.key} failed: ${error.message}`);
    }
  }
}

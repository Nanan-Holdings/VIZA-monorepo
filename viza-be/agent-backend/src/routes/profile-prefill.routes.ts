/**
 * Profile Prefill Routes
 *
 * GET /api/profile/prefill?userId=<uuid>&visaType=<type>
 *
 * Maps applicant_profiles data into visa-specific field names for prefill,
 * with completeness metadata per field group.
 */

import { Router } from "express";
import { Logger } from "../utils/logger.js";
import { getSupabaseClient } from "../db/supabase-client.js";

const logger = new Logger({ serviceName: "ProfilePrefillRoutes" });

export const profilePrefillRouter = Router();

// Field group → profile columns mapping
const FIELD_GROUPS: Record<string, string[]> = {
  personal: ["full_name", "date_of_birth", "place_of_birth", "gender", "nationality", "occupation"],
  passport: ["passport_number", "passport_issue_date", "passport_expiry_date", "passport_issuing_country", "passport_issuing_authority"],
  contact: ["email", "phone", "address", "wechat"],
  employment: ["occupation"],
  travel_history: [],
};

// DS-160 field name mapping from applicant_profiles columns
const DS160_FIELD_MAP: Record<string, string> = {
  full_name: "surname",
  date_of_birth: "date_of_birth",
  place_of_birth: "city_of_birth",
  gender: "sex",
  nationality: "nationality_country",
  passport_number: "passport_number",
  passport_issue_date: "passport_issuance_date",
  passport_expiry_date: "passport_expiration_date",
  passport_issuing_country: "passport_issuing_country",
  email: "email_address",
  phone: "primary_phone",
  address: "home_address_line1",
  occupation: "primary_occupation",
};

// Indonesia B211A uses profile columns directly
const INDONESIA_FIELD_MAP: Record<string, string> = {
  full_name: "full_name",
  date_of_birth: "date_of_birth",
  place_of_birth: "place_of_birth",
  gender: "gender",
  nationality: "nationality",
  occupation: "occupation",
  passport_number: "passport_number",
  passport_issue_date: "passport_issue_date",
  passport_expiry_date: "passport_expiry_date",
  passport_issuing_country: "passport_issuing_country",
  email: "email",
  phone: "phone",
  address: "address",
};

function getFieldMap(visaType: string): Record<string, string> {
  if (visaType.toLowerCase().includes("ds160") || visaType.toLowerCase().includes("b1_b2")) {
    return DS160_FIELD_MAP;
  }
  return INDONESIA_FIELD_MAP;
}

profilePrefillRouter.get("/", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const visaType = (req.query.visaType as string) ?? "indonesia_b211a";

    if (!userId) {
      res.status(400).json({ error: true, message: "userId query param required" });
      return;
    }

    const supabase = getSupabaseClient();

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("applicant_profiles")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (profileError) {
      logger.error("prefill_profile_error", new Error(profileError.message), { userId });
      res.status(500).json({ error: true, message: profileError.message });
      return;
    }

    if (!profile) {
      res.json({ error: false, data: {}, completeness: {} });
      return;
    }

    // Fetch shared_profile_fields completeness
    const { data: spf } = await supabase
      .from("shared_profile_fields")
      .select("field_group, is_complete")
      .eq("applicant_id", profile.id);

    const completenessMap: Record<string, boolean> = {};
    for (const row of spf ?? []) {
      completenessMap[row.field_group] = row.is_complete;
    }

    // Compute completeness per group from actual data
    const groupCompleteness: Record<string, { complete: boolean; filled: number; total: number }> = {};
    for (const [group, columns] of Object.entries(FIELD_GROUPS)) {
      const filled = columns.filter((col) => {
        const val = profile[col as keyof typeof profile];
        return val !== null && val !== undefined && val !== "";
      }).length;
      groupCompleteness[group] = {
        complete: completenessMap[group] ?? (columns.length > 0 && filled === columns.length),
        filled,
        total: columns.length,
      };
    }

    // Map profile data to visa-specific field names
    const fieldMap = getFieldMap(visaType);
    const prefillData: Record<string, unknown> = {};
    for (const [profileCol, visaField] of Object.entries(fieldMap)) {
      const value = profile[profileCol as keyof typeof profile];
      if (value !== null && value !== undefined) {
        prefillData[visaField] = value;
      }
    }

    res.json({
      error: false,
      data: prefillData,
      completeness: groupCompleteness,
    });
  } catch (error) {
    logger.error("prefill_error", error as Error);
    res.status(500).json({
      error: true,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default profilePrefillRouter;

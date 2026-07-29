const CEAC_CHINA_LOCATION_CODES = new Set(["BEJ", "GUZ", "SHG", "SNY", "WUH"]);

const CEAC_CHINA_LOCATION_ALIASES: Record<string, string> = {
  "CHINA, BEIJING": "BEJ",
  BEIJING: "BEJ",
  "CHINA, GUANGZHOU": "GUZ",
  GUANGZHOU: "GUZ",
  "CHINA, SHANGHAI": "SHG",
  SHANGHAI: "SHG",
  "CHINA, SHENYANG": "SNY",
  SHENYANG: "SNY",
  "CHINA, WUHAN": "WUH",
  WUHAN: "WUH",
};

export function resolveCeacStartLocationCode(answers: Record<string, string>): string {
  const candidate = [
    answers.consular_post,
    answers.embassy_or_consulate,
    answers.location_where_applying_for_visa,
  ].find((value) => value?.trim());

  if (!candidate) {
    throw new Error(
      "DS-160 consular post is missing. Return to VIZA and choose the U.S. embassy or consulate where you plan to apply.",
    );
  }

  const normalized = candidate.trim().toUpperCase();
  const code = CEAC_CHINA_LOCATION_ALIASES[normalized] ?? normalized;
  if (!CEAC_CHINA_LOCATION_CODES.has(code)) {
    throw new Error(
      `Unsupported DS-160 consular post "${candidate}". Choose Beijing, Guangzhou, Shanghai, Shenyang, or Wuhan in VIZA.`,
    );
  }

  return code;
}

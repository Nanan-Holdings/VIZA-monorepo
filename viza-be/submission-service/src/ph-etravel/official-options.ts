export const PH_ETRAVEL_OFFICIAL_PORTAL_URL = "https://etravel.gov.ph";

export const PH_ETRAVEL_TRAVEL_TYPES = ["ARRIVAL", "DEPARTURE"] as const;
export const PH_ETRAVEL_TRANSPORT_TYPES = ["AIR", "SEA"] as const;
export const PH_ETRAVEL_REFERENCE_PATTERNS = [
  /(?:reference|transaction|qr)\s*(?:no\.?|number|id|code)?\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
  /\b(ETRAVEL[A-Z0-9-]{6,})\b/i,
] as const;

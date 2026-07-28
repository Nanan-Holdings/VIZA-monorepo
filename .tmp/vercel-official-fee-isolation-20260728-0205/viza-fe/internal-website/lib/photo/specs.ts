/**
 * Per-jurisdiction passport-photo specs (DOC-001).
 *
 * Mirrors docs/photo-specs.md. Pixel dimensions are quoted at 300 dpi
 * (the ICAO and most portal default); the validator allows a ±5%
 * dimension tolerance to absorb cropping rounding.
 */

export interface PhotoSpec {
  country: string;
  visaType: string;
  /** Width × height in pixels at 300 dpi. */
  widthPx: number;
  heightPx: number;
  /** Acceptable file format(s). */
  formats: ReadonlyArray<"jpeg" | "png">;
  /** Max file size in bytes. */
  maxBytes: number;
  /** Background colour pill — surfaced to the user, not validated. */
  background: string;
  /** Head height range in mm. Surfaced for capture-UI guides. */
  headHeightMm: { min: number; max: number };
  /** Tolerance applied to dimension match. Default 0.05. */
  dimensionTolerance?: number;
}

export const PHOTO_SPECS: ReadonlyArray<PhotoSpec> = [
  { country: "united_states", visaType: "B1_B2", widthPx: 600, heightPx: 600, formats: ["jpeg"], maxBytes: 240 * 1024, background: "white / off-white", headHeightMm: { min: 25, max: 35 } },
  { country: "united_kingdom", visaType: "UK_STANDARD_VISITOR", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 5 * 1024 * 1024, background: "light grey / cream", headHeightMm: { min: 29, max: 34 } },
  { country: "european_union", visaType: "EU_SCHENGEN_C_SHORT_STAY", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 240 * 1024, background: "light grey / off-white", headHeightMm: { min: 32, max: 36 } },
  { country: "vietnam", visaType: "VN_E_VISA", widthPx: 472, heightPx: 709, formats: ["jpeg"], maxBytes: 1024 * 1024, background: "white", headHeightMm: { min: 28, max: 33 } },
  { country: "australia", visaType: "AU_VISITOR_600", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 1024 * 1024, background: "plain light", headHeightMm: { min: 32, max: 36 } },
  { country: "japan", visaType: "JP_TOURIST", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 2 * 1024 * 1024, background: "white", headHeightMm: { min: 32, max: 36 } },
  { country: "indonesia", visaType: "B211A", widthPx: 472, heightPx: 709, formats: ["jpeg"], maxBytes: 200 * 1024, background: "red", headHeightMm: { min: 30, max: 35 } },
  { country: "indonesia", visaType: "ID_C1_TOURIST", widthPx: 472, heightPx: 709, formats: ["jpeg"], maxBytes: 200 * 1024, background: "white", headHeightMm: { min: 30, max: 35 } },
  { country: "egypt", visaType: "EG_E_VISA", widthPx: 472, heightPx: 709, formats: ["jpeg"], maxBytes: 1024 * 1024, background: "white", headHeightMm: { min: 30, max: 35 } },
  { country: "south_korea", visaType: "KR_C39_SHORT_TERM_VISIT", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 200 * 1024, background: "white", headHeightMm: { min: 32, max: 36 } },
  { country: "thailand", visaType: "TH_TOURIST_E_VISA", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 2 * 1024 * 1024, background: "white", headHeightMm: { min: 32, max: 36 } },
  { country: "malaysia", visaType: "MY_TOURIST_E_VISA", widthPx: 413, heightPx: 591, formats: ["jpeg"], maxBytes: 1024 * 1024, background: "white / blue", headHeightMm: { min: 30, max: 35 } },
  { country: "singapore", visaType: "SG_VISITOR_VISA", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 60 * 1024, background: "white", headHeightMm: { min: 25, max: 35 } },
  { country: "hong_kong", visaType: "HK_VISIT_VISA", widthPx: 472, heightPx: 591, formats: ["jpeg"], maxBytes: 2 * 1024 * 1024, background: "white", headHeightMm: { min: 32, max: 36 } },
  { country: "macau", visaType: "MO_VISIT_VISA", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 2 * 1024 * 1024, background: "white", headHeightMm: { min: 30, max: 35 } },
  { country: "new_zealand", visaType: "NZ_VISITOR_VISA", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 3 * 1024 * 1024, background: "plain light", headHeightMm: { min: 25, max: 35 } },
  { country: "russia", visaType: "RU_E_VISA", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 5 * 1024 * 1024, background: "white", headHeightMm: { min: 30, max: 35 } },
  { country: "turkey", visaType: "TR_E_VISA", widthPx: 591, heightPx: 709, formats: ["jpeg"], maxBytes: 2 * 1024 * 1024, background: "white", headHeightMm: { min: 32, max: 36 } },
  { country: "united_arab_emirates", visaType: "AE_TOURIST_VISA", widthPx: 508, heightPx: 650, formats: ["jpeg"], maxBytes: 1024 * 1024, background: "white", headHeightMm: { min: 32, max: 36 } },
  { country: "canada", visaType: "CA_TRV", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 3 * 1024 * 1024, background: "plain white", headHeightMm: { min: 31, max: 36 } },
  { country: "maldives", visaType: "MV_IMUGA", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 1024 * 1024, background: "white", headHeightMm: { min: 32, max: 36 } },
  { country: "philippines", visaType: "PH_TEMPORARY_VISITOR_VISA", widthPx: 591, heightPx: 591, formats: ["jpeg"], maxBytes: 500 * 1024, background: "white", headHeightMm: { min: 28, max: 32 } },
  { country: "cambodia", visaType: "KH_TOURIST_E_VISA", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 2 * 1024 * 1024, background: "white", headHeightMm: { min: 30, max: 35 } },
  { country: "laos", visaType: "LA_TOURIST_E_VISA", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 2 * 1024 * 1024, background: "white", headHeightMm: { min: 30, max: 35 } },
  { country: "sri_lanka", visaType: "LK_ETA", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 200 * 1024, background: "white", headHeightMm: { min: 30, max: 35 } },
  { country: "india", visaType: "IN_E_VISA", widthPx: 600, heightPx: 600, formats: ["jpeg"], maxBytes: 1024 * 1024, background: "white", headHeightMm: { min: 25, max: 35 } },
  { country: "south_africa", visaType: "ZA_VISITOR_VISA", widthPx: 413, heightPx: 531, formats: ["jpeg"], maxBytes: 5 * 1024 * 1024, background: "plain light", headHeightMm: { min: 30, max: 35 } },
];

export function specFor(country: string, visaType: string): PhotoSpec | null {
  return (
    PHOTO_SPECS.find((s) => s.country === country && s.visaType === visaType) ??
    null
  );
}

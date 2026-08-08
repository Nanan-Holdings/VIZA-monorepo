import type { FormAssistantSource } from "@/types/form-assistant";

export const SGAC_ICA_SOURCES: FormAssistantSource[] = [
  {
    title: "ICA | SG Arrival Card (SGAC) with Electronic Health Declaration",
    url: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card",
  },
];

export function isFormAssistantEnabled(visaType: string | null | undefined): boolean {
  const normalized = (visaType ?? "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{0,127}$/.test(normalized);
}

export function canUseFormAssistant(params: {
  applicationId: string | null | undefined;
  visaType: string | null | undefined;
  schemaFieldCount: number;
}): boolean {
  return Boolean(
    params.applicationId &&
    params.schemaFieldCount > 0 &&
    isFormAssistantEnabled(params.visaType),
  );
}

export function getFormAssistantFallbackSources(
  country: string | null | undefined,
  visaType: string | null | undefined,
): FormAssistantSource[] {
  const normalizedCountry = (country ?? "").trim().toLowerCase();
  const normalizedVisaType = (visaType ?? "").trim().toUpperCase();
  return ["singapore", "sg", "新加坡"].includes(normalizedCountry) &&
    normalizedVisaType === "SG_ARRIVAL_CARD"
    ? SGAC_ICA_SOURCES
    : [];
}

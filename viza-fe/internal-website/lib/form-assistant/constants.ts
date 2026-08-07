import type { FormAssistantSource } from "@/types/form-assistant";

export const FORM_ASSISTANT_ENABLED_VISA_TYPES = new Set(["SG_ARRIVAL_CARD"]);

export const SGAC_ICA_SOURCES: FormAssistantSource[] = [
  {
    title: "ICA | SG Arrival Card (SGAC) with Electronic Health Declaration",
    url: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card",
  },
];

export function isFormAssistantEnabled(visaType: string | null | undefined): boolean {
  return FORM_ASSISTANT_ENABLED_VISA_TYPES.has((visaType ?? "").trim().toUpperCase());
}

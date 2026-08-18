const KOREA_ARRIVAL_CARD_GATE_PATH = "/client/arrival-cards/south-korea";
const KOREA_ARRIVAL_CARD_FORM_PATH = "/client/application/long-form";

export function buildKoreaArrivalCardGateHref(applicationId?: string | null): string {
  const normalizedApplicationId = applicationId?.trim();
  return normalizedApplicationId
    ? `${KOREA_ARRIVAL_CARD_GATE_PATH}?applicationId=${encodeURIComponent(normalizedApplicationId)}`
    : KOREA_ARRIVAL_CARD_GATE_PATH;
}

export function buildKoreaArrivalCardFormHref(input: {
  adultRepresentative: boolean;
  applicationId?: string | null;
}): string {
  const params = new URLSearchParams({
    country: "south_korea",
    visaType: "KR_E_ARRIVAL_CARD",
    skipFormCheck: "true",
    preflight: "needs_declaration",
    adultRepresentative: input.adultRepresentative ? "true" : "false",
  });
  const normalizedApplicationId = input.applicationId?.trim();
  if (normalizedApplicationId) params.set("applicationId", normalizedApplicationId);
  return `${KOREA_ARRIVAL_CARD_FORM_PATH}?${params.toString()}`;
}

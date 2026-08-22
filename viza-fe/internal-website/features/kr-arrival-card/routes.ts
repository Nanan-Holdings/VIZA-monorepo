const KOREA_ARRIVAL_CARD_GATE_PATH = "/client/arrival-cards/south-korea";
const KOREA_ARRIVAL_CARD_FORM_PATH = "/client/application/long-form";

export function buildKoreaArrivalCardGateHref(applicationId?: string | null): string {
  const normalizedApplicationId = applicationId?.trim();
  return normalizedApplicationId
    ? `${KOREA_ARRIVAL_CARD_GATE_PATH}?applicationId=${encodeURIComponent(normalizedApplicationId)}`
    : KOREA_ARRIVAL_CARD_GATE_PATH;
}

export function buildKoreaArrivalCardIntegratedFormHref(applicationId?: string | null): string {
  const params = new URLSearchParams({
    country: "south_korea",
    visaType: "KR_E_ARRIVAL_CARD",
    skipFormCheck: "true",
  });
  const normalizedApplicationId = applicationId?.trim();
  if (normalizedApplicationId) params.set("applicationId", normalizedApplicationId);
  return `${KOREA_ARRIVAL_CARD_FORM_PATH}?${params.toString()}`;
}

export function buildKoreaArrivalCardFormHref(input: {
  adultRepresentative: boolean;
  applicationId?: string | null;
}): string {
  return buildKoreaArrivalCardIntegratedFormHref(input.applicationId);
}

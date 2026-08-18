export function isKoreaEArrivalCardLiveEnabled(input: {
  serverFlag?: string | null;
  clientFlag?: string | null;
}): boolean {
  return input.serverFlag === "true" && input.clientFlag === "true";
}

function normalizeCountry(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeVisaType(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

export function isIndonesiaPaymentApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
): boolean {
  const normalizedCountry = normalizeCountry(country);
  return (
    normalizedCountry === "id" ||
    normalizedCountry === "indonesia" ||
    normalizeVisaType(visaType).startsWith("ID_")
  );
}

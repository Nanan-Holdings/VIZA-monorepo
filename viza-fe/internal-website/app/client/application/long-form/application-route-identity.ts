import { resolveVisaFormSchemaVisaType } from "@/lib/visa-form-schema-aliases";
import { getCanonicalApplicationProductCountry } from "@/lib/visa-destinations";

type ApplicationIdentityRecord = {
  id?: string | null;
  country?: string | null;
  visa_type?: string | null;
};

export type ApplicationRouteProduct = {
  country: string;
  visaType: string;
  source: "application" | "explicit" | "package" | "fallback";
};

export function resolveApplicationRouteProduct(input: {
  applicationId: string | null;
  application: ApplicationIdentityRecord | null;
  explicitCountry: string | null;
  requestedVisaType: string | null;
  packageCountry: string | null;
  packageVisaType: string | null;
}): ApplicationRouteProduct | null {
  if (input.applicationId) {
    if (
      input.application?.id !== input.applicationId ||
      !input.application.country?.trim() ||
      !input.application.visa_type?.trim()
    ) {
      return null;
    }

    const visaType = resolveVisaFormSchemaVisaType(
      input.application.visa_type,
      input.application.country,
    );
    return {
      country: getCanonicalApplicationProductCountry(
        input.application.country,
        visaType,
      ),
      visaType,
      source: "application",
    };
  }

  const explicitVisaType = input.requestedVisaType
    ? resolveVisaFormSchemaVisaType(
        input.requestedVisaType,
        input.explicitCountry,
      )
    : null;
  const visaType = explicitVisaType ?? input.packageVisaType ?? "ID_C1_TOURIST";
  const country = getCanonicalApplicationProductCountry(
    input.explicitCountry ?? input.packageCountry ?? "indonesia",
    visaType,
  );
  return {
    country,
    visaType,
    source: explicitVisaType
      ? "explicit"
      : input.packageVisaType
        ? "package"
        : "fallback",
  };
}

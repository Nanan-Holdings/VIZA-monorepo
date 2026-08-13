import { readApplicationRouteParam } from "@/lib/client/application-route-params";
import { getFormVisaType } from "@/lib/visa-destinations";

type SearchParamsReader = Pick<URLSearchParams, "get">;

export function shouldSkipFormRequestGateForRoute(
  pathname: string,
  searchParams: SearchParamsReader,
): boolean {
  if (pathname !== "/client/application/long-form") return false;

  const country = readApplicationRouteParam(searchParams, "country")?.trim().toLowerCase();
  const visaType = readApplicationRouteParam(searchParams, "visaType", "visa_type");

  return country === "taiwan" && getFormVisaType(visaType ?? "") === "TW_ENTRY_PERMIT";
}

export function shouldBlockClientChildren(input: {
  sessionValid: boolean | null | "invalidated";
  formRequestChecked: boolean;
  skipFormRequestGate: boolean;
}): boolean {
  if (input.sessionValid === null) return true;

  return (
    input.sessionValid === true &&
    !input.formRequestChecked &&
    !input.skipFormRequestGate
  );
}

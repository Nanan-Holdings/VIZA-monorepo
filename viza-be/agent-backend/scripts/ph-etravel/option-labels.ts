import type { PhEtravelOption } from "./official-options";

export type PhEtravelOptionListKind =
  | "travel_type"
  | "transport_type"
  | "sex"
  | "purpose"
  | "port_of_entry"
  | "occupation"
  | "suffix"
  | "traveller_type"
  | "destination_type"
  | "airline"
  | "flight_number"
  | "yes_no";

export function phEtravelOptionLabelZh(_kind: PhEtravelOptionListKind, option: PhEtravelOption): string {
  return option.label_zh;
}

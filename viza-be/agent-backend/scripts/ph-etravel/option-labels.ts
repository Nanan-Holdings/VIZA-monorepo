import type { PhEtravelOption } from "./official-options";

export type PhEtravelOptionListKind =
  | "travel_type"
  | "transport_type"
  | "sex"
  | "purpose"
  | "port_of_entry"
  | "yes_no";

export function phEtravelOptionLabelZh(_kind: PhEtravelOptionListKind, option: PhEtravelOption): string {
  return option.label_zh;
}

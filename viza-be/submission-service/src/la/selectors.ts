/**
 * Laos (laoevisa.gov.la) selector bindings.
 * FALLBACK + GENERATED merge. See kh/selectors.ts for the contract.
 */
import { GENERATED_LA_SELECTORS } from "./selectors.generated";

const FALLBACK = {
  first_name: 'input[name="first_name"]',
  last_name: 'input[name="last_name"]',
  email: 'input[name="email"]',
  phone: 'input[name="phone"]',
  date_of_birth: 'input[name="date_of_birth"]',
  nationality: 'select[name="nationality"]',
  passport_number: 'input[name="passport_number"]',
  passport_expiry: 'input[name="passport_expiry"]',
  arrival_date: 'input[name="arrival_date"]',
  port_of_entry: 'select[name="port_of_entry"]',
  occupation: 'input[name="occupation"]',
  next_button: 'button:has-text("Next"), button:has-text("Continue")',
} as const;

export type LaSelectorKey = keyof typeof FALLBACK;

export const LA_SELECTORS: Record<LaSelectorKey, string> = {
  ...FALLBACK,
  ...(GENERATED_LA_SELECTORS as Partial<Record<LaSelectorKey, string>>),
};

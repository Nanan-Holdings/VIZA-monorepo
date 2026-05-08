/**
 * Sri Lanka (eta.gov.lk) selector bindings.
 * FALLBACK + GENERATED merge. See kh/selectors.ts for the contract.
 */
import { GENERATED_LK_SELECTORS } from "./selectors.generated";

const FALLBACK = {
  surname: 'input[name="surname"]',
  given_name: 'input[name="given_name"]',
  email: 'input[name="email"]',
  phone: 'input[name="phone"]',
  date_of_birth: 'input[name="date_of_birth"]',
  nationality: 'select[name="nationality"]',
  passport_number: 'input[name="passport_number"]',
  passport_expiry: 'input[name="passport_expiry"]',
  arrival_date: 'input[name="arrival_date"]',
  port_of_arrival: 'select[name="port_of_arrival"]',
  occupation: 'input[name="occupation"]',
  address_in_sri_lanka: 'input[name="address_in_sri_lanka"]',
  visa_variant: 'select[name="visa_variant"]',
  next_button: 'button:has-text("Next"), button:has-text("Continue")',
} as const;

export type LkSelectorKey = keyof typeof FALLBACK;

export const LK_SELECTORS: Record<LkSelectorKey, string> = {
  ...FALLBACK,
  ...(GENERATED_LK_SELECTORS as Partial<Record<LkSelectorKey, string>>),
};

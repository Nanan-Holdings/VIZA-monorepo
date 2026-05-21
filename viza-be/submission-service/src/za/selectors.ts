/**
 * South Africa (evisa.gov.za) selector bindings.
 * FALLBACK + GENERATED merge. See kh/selectors.ts for the contract.
 */
import { GENERATED_ZA_SELECTORS } from "./selectors.generated";

const FALLBACK = {
  given_names: 'input[name="given_names"]',
  surname: 'input[name="surname"]',
  email: 'input[name="email"]',
  phone: 'input[name="phone"]',
  date_of_birth: 'input[name="date_of_birth"]',
  nationality: 'select[name="nationality"]',
  passport_number: 'input[name="passport_number"]',
  passport_expiry: 'input[name="passport_expiry"]',
  passport_issuing_country: 'select[name="passport_issuing_country"]',
  arrival_date: 'input[name="arrival_date"]',
  departure_date: 'input[name="departure_date"]',
  purpose: 'select[name="purpose"]',
  occupation: 'input[name="occupation"]',
  next_button: 'button:has-text("Next"), button:has-text("Continue")',
} as const;

export type ZaSelectorKey = keyof typeof FALLBACK;

export const ZA_SELECTORS: Record<ZaSelectorKey, string> = {
  ...FALLBACK,
  ...(GENERATED_ZA_SELECTORS as Partial<Record<ZaSelectorKey, string>>),
};

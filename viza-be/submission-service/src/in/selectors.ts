/**
 * India (indianvisaonline.gov.in/evisa) selector bindings.
 * FALLBACK + GENERATED merge. See kh/selectors.ts for the contract.
 */
import { GENERATED_IN_SELECTORS } from "./selectors.generated";

const FALLBACK = {
  given_names: 'input[name="given_names"]',
  surname: 'input[name="surname"]',
  email: 'input[name="email"]',
  phone: 'input[name="phone"]',
  date_of_birth: 'input[name="date_of_birth"]',
  nationality: 'select[name="nationality"]',
  passport_number: 'input[name="passport_number"]',
  passport_expiry: 'input[name="passport_expiry"]',
  visa_purpose: 'select[name="visa_purpose"]',
  arrival_date: 'input[name="arrival_date"]',
  port_of_arrival: 'select[name="port_of_arrival"]',
  hospital_name: 'input[name="hospital_name"]',
  conference_name: 'input[name="conference_name"]',
  next_button: 'button:has-text("Continue"), button:has-text("Next")',
} as const;

export type InSelectorKey = keyof typeof FALLBACK;

export const IN_SELECTORS: Record<InSelectorKey, string> = {
  ...FALLBACK,
  ...(GENERATED_IN_SELECTORS as Partial<Record<InSelectorKey, string>>),
};

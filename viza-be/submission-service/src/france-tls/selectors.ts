export const FRANCE_TLS_SELECTORS = {
  loginEmail: 'input[type="email"], input[name*="email" i]',
  loginPassword: 'input[type="password"]',
  applicationReferenceInput: 'input[name*="reference" i], input[id*="reference" i]',
  centerCards: '[data-testid*="vac"], a[href*="/vac/"]',
  slotButtons: 'button:has-text("Book"), button:has-text("Select"), [data-testid*="slot"]',
  paymentCardNumber: 'input[name*="card" i], input[autocomplete="cc-number"]',
  paymentCvc: 'input[name*="cvc" i], input[autocomplete="cc-csc"]',
  confirmationReference: '[data-testid*="confirmation"], .confirmation, .appointment-confirmation',
} as const;

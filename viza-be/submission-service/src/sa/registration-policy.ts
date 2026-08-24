/**
 * Leaf policy module for the VisitSaudi managed-account lifecycle.
 *
 * Kept free of Supabase/Playwright imports (same reason `queue/types.ts` is a
 * leaf) so the rules can be unit-tested without portal or database context.
 */

/**
 * Whether the runner may submit the VisitSaudi registration form.
 *
 * A confirmed managed account must never be re-registered: VisitSaudi rejects
 * the duplicate, and the failed attempt leaves session state that makes the
 * subsequent login report a credential rejection even though the vaulted
 * password is valid. Registration is only ever a first-time step.
 */
export function shouldRegisterSaudiManagedAccount(input: {
  checkpoint: string;
  accountPreparationEnabled: boolean;
  accountConfirmed: boolean;
}): boolean {
  return (
    input.checkpoint === "account_registration" &&
    input.accountPreparationEnabled &&
    !input.accountConfirmed
  );
}

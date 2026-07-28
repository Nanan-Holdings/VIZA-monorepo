/**
 * Account-action errors (LEGAL-004).
 *
 * Lives outside `app/actions/account.ts` because that file carries the
 * `"use server"` directive, and a server-actions module may only export
 * async functions — exporting this class from there makes the bundler
 * reject the whole module ("no exports at all"). Keep runtime non-async
 * exports (classes, constants) here instead.
 */
export class AccountRateLimitError extends Error {
  constructor(action: string, windowSeconds: number) {
    super(
      `Rate limit: ${action} can be requested at most once per ${windowSeconds}s`,
    );
    this.name = "AccountRateLimitError";
  }
}

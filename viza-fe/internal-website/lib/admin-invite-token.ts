import { createHash } from "node:crypto";

/** Hash invitation secrets before any database lookup or persistence. */
export function hashAdminInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

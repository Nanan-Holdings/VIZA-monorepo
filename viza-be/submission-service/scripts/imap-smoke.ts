/**
 * IMAP smoke test — verify env-configured credentials reach the inbox.
 *
 * Connects, lists the most recent INBOX UIDs, prints From/Subject for
 * each. No filtering, no polling — just proves IMAP_HOST / IMAP_EMAIL /
 * IMAP_PASSWORD are wired correctly before per-country runners depend
 * on them.
 *
 * Usage:
 *   cd viza-be/submission-service
 *   npx ts-node scripts/imap-smoke.ts
 */
import { config } from "dotenv";
import * as path from "node:path";
import { ImapFlow } from "imapflow";
import { imapConfigFromEnv } from "../src/email/imap-poll";

config({ path: path.join(__dirname, "../.env") });

async function main() {
  const cfg = imapConfigFromEnv();
  console.log(`[imap-smoke] connecting ${cfg.user}@${cfg.host}:${cfg.port}`);

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure ?? true,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { messages: true, unseen: true });
      console.log(
        `[imap-smoke] INBOX — total=${status.messages ?? 0} unseen=${status.unseen ?? 0}`,
      );

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const search = await client.search({ since }, { uid: true });
      const recent: number[] = Array.isArray(search) ? search : [];
      const lastFive = recent.slice(-5);
      console.log(`[imap-smoke] last ${lastFive.length} messages (past 7 days):`);

      for (const uid of lastFive) {
        const msg = await client.fetchOne(
          String(uid),
          { envelope: true, internalDate: true },
          { uid: true },
        );
        if (!msg) continue;
        const from = msg.envelope?.from?.[0]?.address ?? "?";
        const subject = msg.envelope?.subject ?? "(no subject)";
        const rawDate = msg.internalDate ?? new Date();
        const at = (rawDate instanceof Date ? rawDate : new Date(rawDate)).toISOString();
        console.log(`  uid=${uid} | ${at} | ${from} | ${subject}`);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  console.log("[imap-smoke] OK");
}

main().catch((e) => {
  console.error("[imap-smoke] FAILED:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

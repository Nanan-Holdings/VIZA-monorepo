#!/usr/bin/env npx tsx
/**
 * Inbound email ingest runner — reads the catch-all mailbox and writes
 * `inbound_email` rows keyed by per-applicant alias. See
 * src/email/inbound-ingest.ts.
 *
 *   npx tsx scripts/inbox-ingest.ts            # one pass over the last 24h
 *   npx tsx scripts/inbox-ingest.ts --loop     # poll every 15s
 *   SINCE_MS=600000 npx tsx scripts/inbox-ingest.ts   # narrow the window
 */
import "dotenv/config";
import { ingestOnce } from "../src/email/inbound-ingest";

const loop = process.argv.includes("--loop");
const sinceMs = process.env.SINCE_MS ? Number(process.env.SINCE_MS) : undefined;
const intervalMs = process.env.INGEST_INTERVAL_MS ? Number(process.env.INGEST_INTERVAL_MS) : 15_000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  do {
    const r = await ingestOnce(sinceMs);
    console.log(
      `[ingest] scanned=${r.scanned} ingested=${r.ingested} dup=${r.skippedDuplicate} no_alias=${r.skippedNoAlias}`,
    );
    if (loop) await sleep(intervalMs);
  } while (loop);
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});

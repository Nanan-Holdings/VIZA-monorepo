import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enqueueMatchedVietnamStatusEmails,
  type ParsedVietnamStatusEmail,
} from "../email-status-matcher.js";

type RpcClient = Parameters<typeof enqueueMatchedVietnamStatusEmails>[0];

function makeClient(
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>,
): RpcClient {
  return { rpc } as unknown as RpcClient;
}

function makeEmail(index: number): ParsedVietnamStatusEmail {
  return {
    emailId: `email-${index}`,
    normalizedReference: index % 2 === 0 ? `VN-${index}` : null,
  };
}

test("batches at most 100 parsed emails into one matcher RPC call", async () => {
  const emails = Array.from({ length: 120 }, (_, index) => makeEmail(index));
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = makeClient(async (name, args) => {
    calls.push({ name, args });
    return {
      data: { queued: 7, ambiguous: 8, unmatched: 9, duplicates: 10 },
      error: null,
    };
  });

  const counts = await enqueueMatchedVietnamStatusEmails(client, emails);

  assert.deepEqual(counts, {
    queued: 7,
    ambiguous: 8,
    unmatched: 9,
    duplicates: 10,
  });
  assert.deepEqual(calls, [
    {
      name: "enqueue_vn_email_triggered_status_checks",
      args: { p_emails: emails.slice(0, 100) },
    },
  ]);
});

test("does not call the matcher RPC for an empty email batch", async () => {
  let calls = 0;
  const client = makeClient(async () => {
    calls += 1;
    return { data: null, error: null };
  });

  const counts = await enqueueMatchedVietnamStatusEmails(client, []);

  assert.deepEqual(counts, {
    queued: 0,
    ambiguous: 0,
    unmatched: 0,
    duplicates: 0,
  });
  assert.equal(calls, 0);
});

test("rejects malformed matcher RPC counts", async () => {
  const malformed = [
    { queued: 1, ambiguous: 0, unmatched: 0 },
    { queued: -1, ambiguous: 0, unmatched: 0, duplicates: 0 },
    { queued: 1.5, ambiguous: 0, unmatched: 0, duplicates: 0 },
  ];

  for (const data of malformed) {
    const client = makeClient(async () => ({ data, error: null }));
    await assert.rejects(
      enqueueMatchedVietnamStatusEmails(client, [makeEmail(1)]),
      /invalid Vietnam email matcher counts/i,
    );
  }
});

test("throws when the matcher RPC returns an error", async () => {
  const client = makeClient(async () => ({
    data: null,
    error: { message: "database unavailable" },
  }));

  await assert.rejects(
    enqueueMatchedVietnamStatusEmails(client, [makeEmail(1)]),
    /Failed to enqueue Vietnam email status checks: database unavailable/,
  );
});

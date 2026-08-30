import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
  buildSaveVisibleVisaChatMessageQuery,
  persistVisibleVisaChatMessage,
} from './visible-chat-message.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

describe('visible chat message persistence', () => {
  it('compiles exact-message idempotency into one parameterized statement', () => {
    const query = buildSaveVisibleVisaChatMessageQuery(
      SESSION_ID,
      'user',
      '  hello  '
    );
    expect(query).not.toBeNull();

    const compiled = new PgDialect().sqlToQuery(query!);
    expect(compiled.sql).toMatch(
      /with message_input as \([\s\S]*?insert into "visa_chat_messages" \("session_id", "role", "content"\)[\s\S]*?where not exists \([\s\S]*?existing\.session_id = input\.session_id[\s\S]*?existing\.role = input\.role[\s\S]*?existing\.content = input\.content/iu
    );
    expect(compiled.params).toEqual([SESSION_ID, 'user', 'hello']);
  });

  it('skips empty content without opening a database request', async () => {
    const execute = vi.fn(async () => undefined);

    await expect(
      persistVisibleVisaChatMessage(SESSION_ID, 'assistant', '   ', execute)
    ).resolves.toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses one database request per save across a 100-message burst', async () => {
    const execute = vi.fn(async () => undefined);

    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        persistVisibleVisaChatMessage(
          SESSION_ID,
          index % 2 === 0 ? 'user' : 'assistant',
          `message-${index}`,
          execute
        )
      )
    );

    expect(results.every(Boolean)).toBe(true);
    expect(execute).toHaveBeenCalledTimes(100);
  });

  it('does not retain failures and retries with a fresh statement', async () => {
    const execute = vi
      .fn<(query: ReturnType<typeof buildSaveVisibleVisaChatMessageQuery>) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('temporary database failure'))
      .mockResolvedValueOnce(undefined);

    await expect(
      persistVisibleVisaChatMessage(SESSION_ID, 'user', 'retry me', execute)
    ).rejects.toThrow('temporary database failure');
    await expect(
      persistVisibleVisaChatMessage(SESSION_ID, 'user', 'retry me', execute)
    ).resolves.toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});

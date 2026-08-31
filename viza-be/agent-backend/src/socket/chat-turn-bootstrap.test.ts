import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
  buildChatTurnBootstrapQuery,
  buildPersistedUserChatTurnBootstrapQuery,
  loadChatTurnBootstrap,
  persistUserMessageAndLoadChatTurnBootstrap,
  type ChatTurnBootstrapRow,
} from './chat-turn-bootstrap.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

function row(overrides: Partial<ChatTurnBootstrapRow> = {}): ChatTurnBootstrapRow {
  return {
    sessionId: 'session-1',
    role: 'user',
    content: 'hello',
    memoryJson: { destinationCountries: ['japan'] },
    memoryRevision: 3,
    ...overrides,
  };
}

describe('chat turn bootstrap', () => {
  it('bounds message lookup inside a deterministic lateral subquery', () => {
    const compiled = new PgDialect().sqlToQuery(
      buildChatTurnBootstrapQuery('session-1', 50),
    );

    expect(compiled.sql).toMatch(
      /left join lateral \([\s\S]*?where message\.session_id = session_row\.id[\s\S]*?order by message\.created_at desc, message\.id desc[\s\S]*?limit \$1[\s\S]*?\) as message_row on true/iu,
    );
    expect(compiled.params).toEqual([50, 'session-1']);
  });

  it('loads history and conversation memory with one database loader call', async () => {
    const loader = vi.fn(async () => [
      row({ role: 'assistant', content: 'latest answer' }),
      row({ role: 'user', content: 'earlier question' }),
    ]);

    const bootstrap = await loadChatTurnBootstrap(50, loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(bootstrap.messageRows).toEqual([
      { role: 'assistant', content: 'latest answer' },
      { role: 'user', content: 'earlier question' },
    ]);
    expect(bootstrap.conversationStateSnapshot).toMatchObject({
      memoryJson: { destinationCountries: ['japan'] },
      memoryRevision: 3,
      legacyHistoryComplete: true,
    });
  });

  it('persists the user message and loads the bootstrap in one statement', async () => {
    const query = buildPersistedUserChatTurnBootstrapQuery(
      SESSION_ID,
      '  hello  ',
      50,
    );
    expect(query).not.toBeNull();

    const compiled = new PgDialect().sqlToQuery(query!);
    expect(compiled.sql).toMatch(
      /with message_input as \([\s\S]*?insert into "visa_chat_messages" \("session_id", "role", "content"\)[\s\S]*?where not exists \([\s\S]*?returning "id", "session_id", "role", "content", "created_at"[\s\S]*?union all[\s\S]*?from inserted_message as inserted[\s\S]*?order by candidate\.created_at desc, candidate\.id desc[\s\S]*?limit \$3/iu,
    );
    expect(compiled.params).toEqual([SESSION_ID, 'hello', 50]);
  });

  it('makes one database request per turn across a 100-turn burst', async () => {
    const execute = vi.fn(async () => [row()]);

    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        persistUserMessageAndLoadChatTurnBootstrap(
          SESSION_ID,
          `message-${index}`,
          50,
          execute,
        ),
      ),
    );

    expect(results).toHaveLength(100);
    expect(results.every((result) => result?.messageRows.length === 1)).toBe(true);
    expect(execute).toHaveBeenCalledTimes(100);
  });

  it('skips the combined database request for empty content', async () => {
    const execute = vi.fn(async () => [row()]);

    await expect(
      persistUserMessageAndLoadChatTurnBootstrap(
        SESSION_ID,
        '   ',
        50,
        execute,
      ),
    ).resolves.toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it('represents an empty valid session without inventing a chat message', async () => {
    const bootstrap = await loadChatTurnBootstrap(50, async () => [
      row({ role: null, content: null, memoryJson: {}, memoryRevision: 0 }),
    ]);

    expect(bootstrap.messageRows).toEqual([]);
    expect(bootstrap.conversationStateSnapshot).toMatchObject({
      memoryRevision: 0,
      legacyMessageContents: [],
      legacyHistoryComplete: true,
    });
  });

  it('marks a full page incomplete so legacy memory can use the wider fallback', async () => {
    const rows = Array.from({ length: 50 }, (_, index) =>
      row({ content: `message-${index}`, memoryJson: {} }),
    );

    const bootstrap = await loadChatTurnBootstrap(50, async () => rows);

    expect(bootstrap.conversationStateSnapshot?.legacyHistoryComplete).toBe(false);
  });
});

import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
  buildPersistedChatTurnCompletionQuery,
  persistChatTurnCompletion,
  type ChatTurnCompletionDiagnostic,
} from './chat-turn-completion.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

function buildDiagnostic(
  overrides: Partial<ChatTurnCompletionDiagnostic> = {},
): ChatTurnCompletionDiagnostic {
  return {
    sessionId: SESSION_ID,
    memoryRevision: 7,
    destinationCountry: 'vietnam',
    passportCountryIso3: 'CHN',
    entryRuleOutcome: 'visa_required',
    visaType: 'evisa_tourism',
    recommendedProducts: [
      {
        productCode: 'vn-evisa',
        provider: 'viza',
        requirement: 'required',
      },
    ],
    intent: 'requirements',
    sourceKeys: ['official-vn-evisa'],
    fallbackReason: null,
    model: 'test-model',
    durationMs: 321,
    ...overrides,
  };
}

describe('chat turn completion persistence', () => {
  it('compiles assistant output and redacted diagnostics into one parameterized statement', () => {
    const query = buildPersistedChatTurnCompletionQuery(
      '  private assistant response  ',
      buildDiagnostic(),
    );
    const compiled = new PgDialect().sqlToQuery(query);

    expect(compiled.sql).toMatch(
      /with completion_input as \([\s\S]*?inserted_message as \([\s\S]*?insert into "visa_chat_messages"[\s\S]*?where input\.content <> ''[\s\S]*?where existing\.session_id = input\.session_id[\s\S]*?existing\.role = input\.role[\s\S]*?existing\.content = input\.content[\s\S]*?returning "id"[\s\S]*?inserted_diagnostic as \([\s\S]*?insert into "visa_agent_run_diagnostics"[\s\S]*?returning "id"/iu,
    );
    expect(compiled.sql).not.toContain('private assistant response');
    expect(compiled.sql).not.toContain('official-vn-evisa');
    expect(compiled.params).toEqual([
      SESSION_ID,
      'private assistant response',
      7,
      'vietnam',
      'CHN',
      'visa_required',
      'evisa_tourism',
      '[{"productCode":"vn-evisa","provider":"viza","requirement":"required"}]',
      'requirements',
      '["official-vn-evisa"]',
      null,
      'test-model',
      321,
    ]);
  });

  it('keeps the diagnostic insert when assistant content is empty', () => {
    const compiled = new PgDialect().sqlToQuery(
      buildPersistedChatTurnCompletionQuery('   ', buildDiagnostic()),
    );

    expect(compiled.params[1]).toBe('');
    expect(compiled.sql).toMatch(/where input\.content <> ''/iu);
    expect(compiled.sql).toMatch(/insert into "visa_agent_run_diagnostics"/iu);
  });

  it('uses one database request per completion across a 100-turn burst', async () => {
    const execute = vi.fn(async () => undefined);

    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        persistChatTurnCompletion(
          `assistant-${index}`,
          buildDiagnostic({ durationMs: index }),
          execute,
        ),
      ),
    );

    expect(execute).toHaveBeenCalledTimes(100);
  });

  it('does not retain a failed statement and retries with a fresh request', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary database failure'))
      .mockResolvedValueOnce(undefined);
    const diagnostic = buildDiagnostic();

    await expect(
      persistChatTurnCompletion('retry response', diagnostic, execute),
    ).rejects.toThrow('temporary database failure');
    await expect(
      persistChatTurnCompletion('retry response', diagnostic, execute),
    ).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(2);
  });
});

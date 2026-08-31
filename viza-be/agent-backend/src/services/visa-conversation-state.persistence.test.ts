import { describe, expect, it, vi } from 'vitest';
import {
  createEmptyVisaConversationState,
  persistVisaConversationStateIfChanged,
  shouldPersistVisaConversationState,
  updateVisaConversationState,
  type PersistedVisaConversationState,
  type VisaConversationState,
} from './visa-conversation-state.service.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

function state(
  overrides: Partial<VisaConversationState> = {},
): VisaConversationState {
  return {
    ...createEmptyVisaConversationState(),
    destinationCountries: ['singapore'],
    mainDestination: 'singapore',
    nationality: 'China',
    passportCountryIso3: 'CHN',
    passportType: 'ordinary',
    tripPurpose: 'tourism',
    stayLengthDays: 7,
    updatedAt: '2026-08-31T00:00:00.000Z',
    ...overrides,
  };
}

function persisted(
  value: VisaConversationState,
  source: PersistedVisaConversationState['source'] = 'memory',
): PersistedVisaConversationState {
  return { state: value, revision: 5, source };
}

describe('visa conversation state persistence dedupe', () => {
  it('ignores the per-turn updatedAt timestamp when semantics are unchanged', () => {
    const previous = persisted(state());
    const next = state({ updatedAt: '2026-08-31T00:01:00.000Z' });

    expect(shouldPersistVisaConversationState(previous, next)).toBe(false);
  });

  it('recognizes a real irrelevant follow-up as a no-op after state normalization', () => {
    const previousState = state({
      fieldSources: {
        destinationCountries: 'current_message',
        nationality: 'current_message',
        passportCountryIso3: 'current_message',
        passportType: 'current_message',
        tripPurpose: 'current_message',
        stayLengthDays: 'current_message',
      },
    });
    const next = updateVisaConversationState(
      previousState,
      [{ role: 'user', content: 'Singapore tourism for 7 days' }],
      '谢谢',
    );

    expect(shouldPersistVisaConversationState(persisted(previousState), next)).toBe(false);
  });

  it('treats nested record key order as semantically equivalent', () => {
    const previous = persisted(state({
      schengenDaySplit: { france: 3, germany: 4 },
      fieldSources: {
        nationality: 'profile',
        tripPurpose: 'current_message',
      },
    }));
    const next = state({
      schengenDaySplit: { germany: 4, france: 3 },
      fieldSources: {
        tripPurpose: 'current_message',
        nationality: 'profile',
      },
      updatedAt: '2026-08-31T00:02:00.000Z',
    });

    expect(shouldPersistVisaConversationState(previous, next)).toBe(false);
  });

  it('persists when a routing-relevant field changes', () => {
    const previous = persisted(state());
    const next = state({ stayLengthDays: 31 });

    expect(shouldPersistVisaConversationState(previous, next)).toBe(true);
  });

  it.each(['legacy', 'empty'] as const)(
    'writes an unchanged %s-derived state once to establish structured memory',
    (source) => {
      const value = state();
      expect(shouldPersistVisaConversationState(persisted(value, source), value)).toBe(true);
    },
  );

  it('skips all writes across 100 unchanged structured-memory turns', async () => {
    const value = state();
    const save = vi.fn(async () => 6);

    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        persistVisaConversationStateIfChanged(
          SESSION_ID,
          { ...value, updatedAt: new Date(index).toISOString() },
          persisted(value),
          save,
        ),
      ),
    );

    expect(save).not.toHaveBeenCalled();
    expect(results.every((result) => !result.wrote && result.revision === 5)).toBe(true);
  });

  it('writes exactly once with the existing optimistic revision when state changes', async () => {
    const previous = persisted(state());
    const next = state({ tripPurpose: 'business' });
    const save = vi.fn(async () => 6);

    await expect(
      persistVisaConversationStateIfChanged(
        SESSION_ID,
        next,
        previous,
        save,
      ),
    ).resolves.toEqual({ revision: 6, wrote: true });
    expect(save).toHaveBeenCalledWith(SESSION_ID, next, 5);
  });

  it('keeps write failures retryable without caching state', async () => {
    const previous = persisted(state());
    const next = state({ tripPurpose: 'business' });
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary database failure'))
      .mockResolvedValueOnce(6);

    await expect(
      persistVisaConversationStateIfChanged(SESSION_ID, next, previous, save),
    ).rejects.toThrow('temporary database failure');
    await expect(
      persistVisaConversationStateIfChanged(SESSION_ID, next, previous, save),
    ).resolves.toEqual({ revision: 6, wrote: true });
    expect(save).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from 'vitest';
import {
  VISA_CONVERSATION_STATE_MARKER_PREFIX,
  createEmptyVisaConversationState,
  resolveVisaConversationStateSnapshot,
} from './visa-conversation-state.service.js';

describe('conversation state request snapshot', () => {
  it('uses normalized structured memory without another database read', () => {
    const result = resolveVisaConversationStateSnapshot({
      memoryJson: {
        destinationCountries: ['japan'],
        mainDestination: 'japan',
        nationality: 'China',
      },
      memoryRevision: 7,
      legacyMessageContents: [],
      legacyHistoryComplete: true,
    });

    expect(result?.revision).toBe(7);
    expect(result?.state.mainDestination).toBe('japan');
    expect(result?.state.nationality).toBe('China');
  });

  it('recovers the newest legacy marker from a complete message snapshot', () => {
    const older = createEmptyVisaConversationState();
    older.nationality = 'Singapore';
    const newer = createEmptyVisaConversationState();
    newer.nationality = 'China';

    const result = resolveVisaConversationStateSnapshot({
      memoryJson: {},
      memoryRevision: 0,
      legacyMessageContents: [
        `${VISA_CONVERSATION_STATE_MARKER_PREFIX}${JSON.stringify(newer)}`,
        'visible message',
        `${VISA_CONVERSATION_STATE_MARKER_PREFIX}${JSON.stringify(older)}`,
      ],
      legacyHistoryComplete: true,
    });

    expect(result?.state.nationality).toBe('China');
  });

  it('requires the wider fallback only when an empty-memory page is truncated', () => {
    expect(resolveVisaConversationStateSnapshot({
      memoryJson: {},
      memoryRevision: 2,
      legacyMessageContents: Array.from({ length: 50 }, () => 'visible message'),
      legacyHistoryComplete: false,
    })).toBeNull();

    const complete = resolveVisaConversationStateSnapshot({
      memoryJson: {},
      memoryRevision: 2,
      legacyMessageContents: [],
      legacyHistoryComplete: true,
    });
    expect(complete?.revision).toBe(2);
    expect(complete?.state.destinationCountries).toEqual([]);
  });
});

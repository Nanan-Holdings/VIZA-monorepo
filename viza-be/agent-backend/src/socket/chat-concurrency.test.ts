import { describe, expect, it, vi } from 'vitest';
import {
  ChatCapacityError,
  ChatConcurrencyGate,
  readChatCapacityLimits,
} from './chat-concurrency.js';

describe('ChatConcurrencyGate', () => {
  it('returns bounded defaults without trusting invalid environment values', () => {
    expect(readChatCapacityLimits({})).toEqual({
      maxActive: 16,
      maxQueued: 64,
      queueTimeoutMs: 8_000,
    });
    expect(
      readChatCapacityLimits({
        VISA_CHAT_MAX_CONCURRENCY: '999',
        VISA_CHAT_MAX_QUEUE: '9999',
        VISA_CHAT_QUEUE_TIMEOUT_MS: '999999',
      }),
    ).toEqual({ maxActive: 100, maxQueued: 1_000, queueTimeoutMs: 60_000 });
  });

  it('hands a released slot to the next queued request', async () => {
    const gate = new ChatConcurrencyGate(1, 2, 1_000);
    const releaseFirst = await gate.acquire();
    const second = gate.acquire();

    expect(gate.getStats()).toMatchObject({
      active: 1,
      queued: 1,
      peakActive: 1,
      peakQueued: 1,
      accepted: 1,
      completed: 0,
      rejectedFull: 0,
      timedOut: 0,
      aborted: 0,
    });
    releaseFirst();
    const releaseSecond = await second;
    expect(gate.getStats()).toMatchObject({
      active: 1,
      queued: 0,
      accepted: 2,
      completed: 1,
    });

    releaseSecond();
    expect(gate.getStats()).toMatchObject({ active: 0, queued: 0, completed: 2 });
  });

  it('rejects immediately when the bounded queue is full', async () => {
    const gate = new ChatConcurrencyGate(1, 1, 1_000);
    const release = await gate.acquire();
    const queued = gate.acquire();

    await expect(gate.acquire()).rejects.toMatchObject<ChatCapacityError>({
      code: 'QUEUE_FULL',
    });
    expect(gate.getStats().rejectedFull).toBe(1);

    release();
    (await queued)();
  });

  it('removes a queued request after its deadline', async () => {
    vi.useFakeTimers();
    const gate = new ChatConcurrencyGate(1, 1, 50);
    const release = await gate.acquire();
    const queued = gate.acquire();

    const rejection = expect(queued).rejects.toMatchObject<ChatCapacityError>({
      code: 'QUEUE_TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(50);
    await rejection;
    expect(gate.getStats()).toMatchObject({
      active: 1,
      queued: 0,
      timedOut: 1,
    });

    release();
    vi.useRealTimers();
  });

  it('counts aborts without retaining request identity', async () => {
    const gate = new ChatConcurrencyGate(1, 1, 1_000);
    const release = await gate.acquire();
    const controller = new AbortController();
    const queued = gate.acquire(controller.signal);
    controller.abort();

    await expect(queued).rejects.toMatchObject<ChatCapacityError>({ code: 'ABORTED' });
    expect(gate.getStats()).toMatchObject({ aborted: 1, active: 1, queued: 0 });
    expect(JSON.stringify(gate.getStats())).not.toMatch(/user|session|message/i);
    release();
  });
});

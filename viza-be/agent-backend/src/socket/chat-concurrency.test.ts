import { describe, expect, it, vi } from 'vitest';
import { ChatCapacityError, ChatConcurrencyGate } from './chat-concurrency.js';

describe('ChatConcurrencyGate', () => {
  it('hands a released slot to the next queued request', async () => {
    const gate = new ChatConcurrencyGate(1, 2, 1_000);
    const releaseFirst = await gate.acquire();
    const second = gate.acquire();

    expect(gate.getStats()).toEqual({ active: 1, queued: 1 });
    releaseFirst();
    const releaseSecond = await second;
    expect(gate.getStats()).toEqual({ active: 1, queued: 0 });

    releaseSecond();
    expect(gate.getStats()).toEqual({ active: 0, queued: 0 });
  });

  it('rejects immediately when the bounded queue is full', async () => {
    const gate = new ChatConcurrencyGate(1, 1, 1_000);
    const release = await gate.acquire();
    const queued = gate.acquire();

    await expect(gate.acquire()).rejects.toMatchObject<ChatCapacityError>({
      code: 'QUEUE_FULL',
    });

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
    expect(gate.getStats()).toEqual({ active: 1, queued: 0 });

    release();
    vi.useRealTimers();
  });
});

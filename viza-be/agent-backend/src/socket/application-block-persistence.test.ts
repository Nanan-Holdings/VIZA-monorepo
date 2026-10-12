import { describe, expect, it, vi } from 'vitest';
import type { ApplicationBlockPayload } from '../agent/index.js';
import {
  buildApplicationBlockMessageRows,
  persistApplicationBlocks,
  persistApplicationBlocksWithFallback,
} from './application-block-persistence.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

function buildBlock(index: number): ApplicationBlockPayload {
  return {
    blockType: 'application_redirect',
    title: `Application ${index}`,
    fields: [],
    saveTarget: 'application',
    country: index % 2 === 0 ? 'singapore' : 'thailand',
    visaType: `TYPE_${index}`,
    productCode: `PRODUCT_${index}`,
    provider: 'viza',
    requirement: 'required',
    redirectUrl: `/client/application?product=${index}`,
  };
}

describe('application block batch persistence', () => {
  it('maps every emitted block to the existing chat-message contract in order', () => {
    const blocks = [buildBlock(1), buildBlock(2), buildBlock(3)];

    const rows = buildApplicationBlockMessageRows(
      SESSION_ID,
      blocks,
      Date.parse('2026-08-31T00:00:00.000Z'),
    );

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.content)).toEqual([
      'Application 1',
      'Application 2',
      'Application 3',
    ]);
    expect(rows.every((row) => row.sessionId === SESSION_ID)).toBe(true);
    expect(rows.every((row) => row.role === 'block')).toBe(true);
    expect(rows.map((row) => row.blockData)).toEqual(blocks);
    expect(rows.map((row) => row.createdAt?.toISOString())).toEqual([
      '2026-08-31T00:00:00.000Z',
      '2026-08-31T00:00:00.001Z',
      '2026-08-31T00:00:00.002Z',
    ]);
  });

  it('persists three blocks through one database request', async () => {
    const execute = vi.fn(async () => undefined);

    await expect(
      persistApplicationBlocks(
        SESSION_ID,
        [buildBlock(1), buildBlock(2), buildBlock(3)],
        execute,
      ),
    ).resolves.toBe(true);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toHaveLength(3);
  });

  it('skips the database when no block is emitted', async () => {
    const execute = vi.fn(async () => undefined);

    await expect(
      persistApplicationBlocks(SESSION_ID, [], execute),
    ).resolves.toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses one request per turn across 100 three-block turns', async () => {
    const execute = vi.fn(async () => undefined);
    const blocks = [buildBlock(1), buildBlock(2), buildBlock(3)];

    await Promise.all(
      Array.from({ length: 100 }, () =>
        persistApplicationBlocks(SESSION_ID, blocks, execute),
      ),
    );

    expect(execute).toHaveBeenCalledTimes(100);
  });

  it('does not retain failures and retries with a fresh batch', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary database failure'))
      .mockResolvedValueOnce(undefined);
    const blocks = [buildBlock(1), buildBlock(2)];

    await expect(
      persistApplicationBlocks(SESSION_ID, blocks, execute),
    ).rejects.toThrow('temporary database failure');
    await expect(
      persistApplicationBlocks(SESSION_ID, blocks, execute),
    ).resolves.toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('falls back to the original ordered rows after an atomic batch failure', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('batch unavailable'))
      .mockResolvedValue(undefined);
    const blocks = [buildBlock(1), buildBlock(2), buildBlock(3)];

    const result = await persistApplicationBlocksWithFallback(
      SESSION_ID,
      blocks,
      execute,
    );

    expect(result).toEqual({
      mode: 'fallback',
      batchErrorName: 'TypeError',
      failedBlocks: [],
    });
    expect(execute).toHaveBeenCalledTimes(4);
    expect(execute.mock.calls.slice(1).map(([rows]) => rows[0].content)).toEqual([
      'Application 1',
      'Application 2',
      'Application 3',
    ]);
  });

  it('reports only redacted error names for rows that still fail in fallback', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('batch contains private values'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new RangeError('row contains private values'))
      .mockResolvedValueOnce(undefined);

    const result = await persistApplicationBlocksWithFallback(
      SESSION_ID,
      [buildBlock(1), buildBlock(2), buildBlock(3)],
      execute,
    );

    expect(result).toEqual({
      mode: 'fallback',
      batchErrorName: 'Error',
      failedBlocks: [{ index: 1, errorName: 'RangeError' }],
    });
    expect(JSON.stringify(result)).not.toContain('private values');
  });
});

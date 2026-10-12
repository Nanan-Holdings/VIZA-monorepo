import type { ApplicationBlockPayload } from '../agent/index.js';
import type { NewVisaChatMessage } from '../db/schema.js';

export type ApplicationBlockMessageRow = NewVisaChatMessage & {
  role: 'block';
};

export type ApplicationBlockBatchExecutor = (
  rows: ApplicationBlockMessageRow[],
) => Promise<unknown>;

export interface ApplicationBlockPersistenceResult {
  mode: 'skipped' | 'batch' | 'fallback';
  batchErrorName: string | null;
  failedBlocks: Array<{ index: number; errorName: string }>;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

export function buildApplicationBlockMessageRows(
  sessionId: string,
  blocks: ApplicationBlockPayload[],
  nowMs: number = Date.now(),
): ApplicationBlockMessageRow[] {
  return blocks.map((block, index) => ({
    sessionId,
    role: 'block',
    content: block.title,
    blockData: block as unknown as Record<string, unknown>,
    // A batch shares one database transaction timestamp. Explicit monotonic
    // values preserve the former sequential insert order after a page reload.
    createdAt: new Date(nowMs + index),
  }));
}

/**
 * Persist every block emitted by one chat turn in one database request. The
 * caller owns UI emission and may retry with one-block batches after failure.
 */
export async function persistApplicationBlocks(
  sessionId: string,
  blocks: ApplicationBlockPayload[],
  execute: ApplicationBlockBatchExecutor,
): Promise<boolean> {
  const rows = buildApplicationBlockMessageRows(sessionId, blocks);
  if (rows.length === 0) return false;
  await execute(rows);
  return true;
}

/**
 * Prefer one atomic batch. If it fails, retry the original ordered rows one at
 * a time so a transient or row-specific issue does not discard every block.
 */
export async function persistApplicationBlocksWithFallback(
  sessionId: string,
  blocks: ApplicationBlockPayload[],
  execute: ApplicationBlockBatchExecutor,
): Promise<ApplicationBlockPersistenceResult> {
  const rows = buildApplicationBlockMessageRows(sessionId, blocks);
  if (rows.length === 0) {
    return { mode: 'skipped', batchErrorName: null, failedBlocks: [] };
  }

  try {
    await execute(rows);
    return { mode: 'batch', batchErrorName: null, failedBlocks: [] };
  } catch (batchError) {
    const failedBlocks: ApplicationBlockPersistenceResult['failedBlocks'] = [];
    for (const [index, row] of rows.entries()) {
      try {
        await execute([row]);
      } catch (fallbackError) {
        failedBlocks.push({ index, errorName: errorName(fallbackError) });
      }
    }
    return {
      mode: 'fallback',
      batchErrorName: errorName(batchError),
      failedBlocks,
    };
  }
}

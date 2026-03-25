/**
 * PGMQ Type-Safe Helpers
 *
 * Centralized wrappers for pgmq operations with proper PostgreSQL type casting.
 * Prevents "function is not unique" errors by explicitly casting all parameters.
 *
 * Why this exists:
 * - PostgreSQL has multiple overloaded pgmq functions
 * - JavaScript types don't map directly to PostgreSQL types
 * - drizzle-orm sql template doesn't auto-cast
 * - Without explicit casts, PostgreSQL can't determine which function to use
 *
 * Usage:
 * ```typescript
 * import { pgmqSend, pgmqArchive, pgmqRead } from '../utils/pgmq.helpers.js';
 *
 * // Instead of: sql`SELECT pgmq.send('queue', ${data}::jsonb, ${timeout})`
 * await pgmqSend(db, 'queue', data, timeout);
 *
 * // Instead of: sql`SELECT pgmq.archive('queue', ${msgId}::bigint)`
 * await pgmqArchive(db, 'queue', msgId);
 * ```
 */

import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Generic db type that accepts any schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>;

/**
 * Send a message to a pgmq queue
 *
 * @param db - Drizzle database instance
 * @param queueName - Name of the queue
 * @param message - Message payload (will be converted to JSONB)
 * @param visibilityTimeout - Optional visibility timeout in seconds (default: 0 = immediate)
 * @returns msg_id of the enqueued message
 */
export async function pgmqSend(
	db: AnyDb,
	queueName: string,
	message: Record<string, unknown>,
	visibilityTimeout = 0
): Promise<string> {
	const result = await db.execute(
		sql`SELECT pgmq.send(
			${queueName}::text,
			${JSON.stringify(message)}::jsonb,
			${visibilityTimeout}::integer
		) as msg_id`
	);

	const rows = (result.rows ?? result) as unknown as Array<{ msg_id: string }>;
	return rows[0]?.msg_id;
}

/**
 * Archive a message from a pgmq queue
 *
 * @param db - Drizzle database instance
 * @param queueName - Name of the queue
 * @param msgId - Message ID to archive (can be string or number)
 * @returns Success boolean
 */
export async function pgmqArchive(
	db: AnyDb,
	queueName: string,
	msgId: string | number
): Promise<boolean> {
	const result = await db.execute(
		sql`SELECT pgmq.archive(
			${queueName}::text,
			${String(msgId)}::bigint
		) as archived`
	);

	const rows = (result.rows ?? result) as unknown as Array<{ archived: boolean }>;
	return rows[0]?.archived ?? false;
}

/**
 * Read messages from a pgmq queue
 *
 * @param db - Drizzle database instance
 * @param queueName - Name of the queue
 * @param visibilityTimeout - Visibility timeout in seconds
 * @param batchSize - Number of messages to read (default: 1)
 * @returns Array of messages
 */
export async function pgmqRead<T = Record<string, unknown>>(
	db: AnyDb,
	queueName: string,
	visibilityTimeout: number,
	batchSize = 1
): Promise<Array<PgmqMessage<T>>> {
	const result = await db.execute(
		sql`SELECT * FROM pgmq.read(
			${queueName}::text,
			${visibilityTimeout}::integer,
			${batchSize}::integer
		)`
	);

	return (result.rows ?? result) as unknown as Array<PgmqMessage<T>>;
}

/**
 * Delete a message from a pgmq queue
 *
 * @param db - Drizzle database instance
 * @param queueName - Name of the queue
 * @param msgId - Message ID to delete
 * @returns Success boolean
 */
export async function pgmqDelete(
	db: AnyDb,
	queueName: string,
	msgId: string | number
): Promise<boolean> {
	const result = await db.execute(
		sql`SELECT pgmq.delete(
			${queueName}::text,
			${String(msgId)}::bigint
		) as deleted`
	);

	const rows = (result.rows ?? result) as unknown as Array<{ deleted: boolean }>;
	return rows[0]?.deleted ?? false;
}

/**
 * Get metrics for a pgmq queue
 *
 * @param db - Drizzle database instance
 * @param queueName - Name of the queue
 * @returns Queue metrics
 */
export async function pgmqMetrics(
	db: AnyDb,
	queueName: string
): Promise<PgmqMetrics> {
	const result = await db.execute(
		sql`SELECT * FROM pgmq.metrics(${queueName}::text)`
	);

	const rows = (result.rows ?? result) as unknown as Array<PgmqMetrics>;
	return rows[0];
}

/**
 * PGMQ Message Type
 */
export interface PgmqMessage<T = Record<string, unknown>> {
	msg_id: string;
	read_ct: number;
	enqueued_at: string;
	vt: string;
	message: T;
}

/**
 * PGMQ Metrics Type
 */
export interface PgmqMetrics {
	queue_name: string;
	queue_length: number;
	newest_msg_age_sec: number | null;
	oldest_msg_age_sec: number | null;
	total_messages: number;
	scrape_time: string;
}

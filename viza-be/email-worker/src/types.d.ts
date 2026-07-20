/**
 * Minimal ambient types for the Cloudflare Email Worker runtime.
 *
 * Mirrors the subset of `@cloudflare/workers-types` we actually consume.
 * Declaring these locally lets `tsc --noEmit` pass without an
 * `npm install` step in this repo. When the worker is deployed,
 * Wrangler bundles the real Cloudflare runtime types automatically.
 */

declare global {
  // Ambient runtime globals from the Cloudflare Workers + WHATWG environment.
  // Real types are pulled in by Wrangler at build time; these stubs keep
  // `tsc --noEmit` self-contained for repo-level CI.
  function fetch(input: string, init?: unknown): Promise<Response>;
  function btoa(value: string): string;
  interface Response {
    ok: boolean;
    status: number;
    text(): Promise<string>;
    json(): Promise<unknown>;
  }
  const crypto: {
    randomUUID(): string;
  };
  const console: {
    error(...values: unknown[]): void;
  };
  class TextDecoder {
    constructor(label?: string, options?: { fatal?: boolean });
    decode(input?: Uint8Array | ArrayBuffer): string;
  }

  /** A readable stream of bytes, as exposed by Cloudflare's runtime. */
  interface ReadableStream<R = unknown> {
    getReader(): ReadableStreamDefaultReader<R>;
  }
  interface ReadableStreamDefaultReader<R = unknown> {
    read(): Promise<{ done: boolean; value: R | undefined }>;
    releaseLock(): void;
  }

  /** Subset of the Cloudflare R2 binding API we use here. */
  interface R2Bucket {
    put(
      key: string,
      value: ArrayBuffer | Uint8Array | string,
      options?: { httpMetadata?: { contentType?: string } },
    ): Promise<unknown>;
    get(key: string): Promise<R2ObjectBody | null>;
  }
  interface R2ObjectBody {
    arrayBuffer(): Promise<ArrayBuffer>;
  }

  /** Subset of `EmailMessage` (Cloudflare Email Worker `email()` arg). */
  interface CfEmailHeaders {
    get(name: string): string | null;
  }
  interface CfEmailMessage {
    from: string;
    to: string;
    headers: CfEmailHeaders;
    rawSize: number;
    raw: ReadableStream<Uint8Array>;
  }
  interface ScheduledController {
    scheduledTime: number;
    cron: string;
  }
  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
  }
}

export {};

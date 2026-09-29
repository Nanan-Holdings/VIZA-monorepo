import { createClient } from "@supabase/supabase-js";
import type { Ds160AuditStorageTransport } from "./audit-storage";

const BUCKET = "submission-artifacts";

/** Isolated clients bind cancellation to each private audit request. */
export function createDs160AuditStorageTransport(options: {
  url: string;
  key: string;
  fetch?: typeof fetch;
}): Ds160AuditStorageTransport {
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const storageFor = (signal: AbortSignal) => createClient(options.url, options.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      // Storage.upload has no per-call signal in the installed SDK. The
      // request-scoped client supplies it at the actual fetch boundary.
      fetch: (input, init) => fetchRequest(input, { ...init, signal }),
    },
  }).storage.from(BUCKET);

  return {
    async upload({ path, body, contentType, signal }) {
      const { data, error } = await storageFor(signal).upload(path, Buffer.from(body), {
        contentType,
        upsert: false,
      });
      signal.throwIfAborted();
      if (error) throw error;
      if (!data || data.path !== path) throw new Error("Audit storage write was not acknowledged.");
    },
    async download({ path, signal }) {
      const { data, error } = await storageFor(signal).download(path);
      signal.throwIfAborted();
      if (error) {
        // A missing object permits a same-bytes retry; a missing bucket or
        // authorization failure does not. Keep the SDK error for classification.
        if (/^(?:object|resource) not found\.?$/i.test(error.message.trim())) return null;
        throw error;
      }
      if (!data) throw new Error("Audit storage read was not acknowledged.");
      const bytes = new Uint8Array(await data.arrayBuffer());
      signal.throwIfAborted();
      return bytes;
    },
  };
}

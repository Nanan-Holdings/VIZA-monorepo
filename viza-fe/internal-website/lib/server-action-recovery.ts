const STALE_SERVER_ACTION_RELOAD_KEY = "viza:stale-server-action-reload";
const DEFAULT_RELOAD_COOLDOWN_MS = 30_000;

let reloadAttemptedInCurrentDocument = false;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error ?? "");
}

export function isStaleServerActionError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("failed to find server action") ||
    (message.includes("server action") && message.includes("was not found on the server")) ||
    message.includes("failed-to-find-server-action")
  );
}

type StaleServerActionRecoveryOptions = {
  cooldownMs?: number;
  now?: number;
  reload?: () => void;
  storage?: Pick<Storage, "getItem" | "setItem">;
  storageKey?: string;
};

/**
 * A Server Action ID is tied to the client bundle that rendered the page.
 * After a deploy, dev-server restart, or hot rebuild, an older tab can retain
 * an ID that the current server no longer recognizes. One hard reload obtains
 * the current action manifest. The session timestamp prevents reload loops if
 * the server is genuinely unhealthy.
 */
export function attemptStaleServerActionReload(
  error: unknown,
  options: StaleServerActionRecoveryOptions = {},
): boolean {
  if (!isStaleServerActionError(error) || reloadAttemptedInCurrentDocument) return false;

  const browserWindow = typeof window === "undefined" ? null : window;
  if (!browserWindow && !options.reload) return false;
  const reload = options.reload ?? (() => browserWindow?.location.reload());
  const storage = options.storage ?? browserWindow?.sessionStorage;
  const now = options.now ?? Date.now();
  const cooldownMs = options.cooldownMs ?? DEFAULT_RELOAD_COOLDOWN_MS;
  const pageKey = browserWindow
    ? `${browserWindow.location.pathname}${browserWindow.location.search}`
    : "unknown";
  const storageKey = options.storageKey ?? `${STALE_SERVER_ACTION_RELOAD_KEY}:${pageKey}`;

  try {
    const previousAttempt = Number(storage?.getItem(storageKey) ?? 0);
    if (previousAttempt > 0 && Number.isFinite(previousAttempt) && now - previousAttempt < cooldownMs) {
      return false;
    }
    storage?.setItem(storageKey, String(now));
  } catch {
    // Some hardened browser contexts disable sessionStorage. The in-document
    // guard still prevents repeated reload calls before navigation completes.
  }

  reloadAttemptedInCurrentDocument = true;
  reload();
  return true;
}

export function resetStaleServerActionRecoveryForTests() {
  reloadAttemptedInCurrentDocument = false;
}

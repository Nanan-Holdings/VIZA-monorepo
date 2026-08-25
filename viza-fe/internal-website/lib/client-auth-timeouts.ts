// Keep the browser deadline above the server's Supabase/SMTP deadline so the
// API can return the real Auth result instead of being misreported as an outage.
export const AUTH_REQUEST_TIMEOUT_MS = 25_000;

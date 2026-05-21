-- =============================================================================
-- Inbound mail layer (INBOX-002)
--
-- Every message that lands at *@haggstorm.com via Cloudflare Email Routing
-- + Email Worker is written here. The worker also writes large bodies
-- (>1 MB, by default) to R2 and stores the key in `r2_key`.
--
-- Reads: RLS deny-by-default. INBOX-003 wires per-applicant access; until
-- then, only the service-role client (worker insert + agent-backend
-- consumers) can read.
-- =============================================================================

CREATE TABLE IF NOT EXISTS inbound_email (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  /** Lowercased recipient — normalised so per-applicant lookups are case-insensitive. */
  to_addr TEXT NOT NULL,
  /** Original from header value (display name + address). */
  from_addr TEXT NOT NULL,
  subject TEXT,
  message_id TEXT,
  /** RFC 822 text body when present and < the worker's inline cap (1 MB by default). */
  text TEXT,
  /** RFC 822 html body when present and < the worker's inline cap. */
  html TEXT,
  /** Selected header lines (from / to / subject / message-id / received) preserved verbatim. */
  headers JSONB,
  /** Size of the original raw message in bytes. */
  raw_size INTEGER NOT NULL,
  /** R2 object key when the body was offloaded; NULL when stored inline. */
  r2_key TEXT,
  /** Cloudflare-supplied spam score (0..1). NULL when not provided. */
  spam_score REAL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /** Set true once a runner has consumed the message (e.g. OTP extracted). */
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_email_to_addr_received
  ON inbound_email(to_addr, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbound_email_received_at
  ON inbound_email(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbound_email_unprocessed
  ON inbound_email(received_at DESC) WHERE processed = FALSE;

ALTER TABLE inbound_email ENABLE ROW LEVEL SECURITY;
-- No SELECT / INSERT policies. Service role only until INBOX-003 wires
-- per-applicant alias joins.

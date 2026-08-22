# Resilience Replay API

Scope: this file applies to `app/api/resilience/**`.

These routes are server-to-server recovery surfaces for the independent VIZA
resilience Worker. Require the shared HMAC signature, bounded timestamp, and
one-time nonce before parsing or decrypting event payloads. Never log encrypted
blobs, decrypted PII, OTPs, HMAC secrets, or data-encryption keys.

Replay handlers must use an explicit event-type allowlist and re-check resource
ownership in Postgres. Every operation must be idempotent and safe under
duplicate or out-of-order delivery. Do not expose claim, ack, or nack controls
to browsers.

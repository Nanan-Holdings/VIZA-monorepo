# Lessons Learned

Patterns and rules derived from past corrections. Reviewed at the start of each session.

---

## 2026-07-25 — Assumed the test environment was the target
**What happened:** A vendor notice about a sandbox/UAT environment migration was pasted alongside the request. I treated the notice as the objective and spent the session probing sandbox hosts and driving the sandbox portal, when the actual target was the production account at portal.photonpay.com.
**Rule:** Pasted vendor/ops notices are context, not the goal. Confirm which environment the user is actually working in before probing hosts or opening a portal — ask if the request does not say. A migration notice explains what changed; it does not mean the migrated environment is the one to integrate against.

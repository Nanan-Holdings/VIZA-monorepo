# Lessons Learned

Patterns and rules derived from past corrections. Reviewed at the start of each session.

---

## 2026-07-25 — Assumed the test environment was the target
**What happened:** A vendor notice about a sandbox/UAT environment migration was pasted alongside the request. I treated the notice as the objective and spent the session probing sandbox hosts and driving the sandbox portal, when the actual target was the production account at portal.photonpay.com.
**Rule:** Pasted vendor/ops notices are context, not the goal. Confirm which environment the user is actually working in before probing hosts or opening a portal — ask if the request does not say. A migration notice explains what changed; it does not mean the migrated environment is the one to integrate against.

## 2026-08-31 — Asked for confirmation instead of acting
**What happened:** The agent treated normal in-scope execution and dependent actions as new permission boundaries, repeatedly asking the user to confirm.
**Rule:** A direct request authorizes every normal, necessary step to complete it. Act without intermediate confirmation prompts; ask only when the target is genuinely indeterminate or an unrequested material commitment would be made.

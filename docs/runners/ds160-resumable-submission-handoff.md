# DS-160 Resumable Submission Handoff

Date: 2026-09-11

This packet is the starting point for a teammate and their AI agent to review,
test, and continue the United States DS-160 background submission runner. It is
sanitized: do not add applicant answers, names, email addresses, application
IDs, recovery answers, screenshots, browser profiles, database rows, or secret
values to this document, commits, test output, or PR discussion.

## Branch and Scope

- Base: latest `origin/main` at the time this packet was created.
- Branch: `codex/ds160-resumable-submission-20260911`.
- Scope: `viza-be/submission-service` plus this handoff document.
- Merge through the branch PR. Do not cherry-pick from the long-lived local
  integration branch, because its history has diverged from remote `main`.
- The branch does not include unrelated frontend, dashboard, interview, UK,
  Taiwan, marital-status, SSN, draft, environment, or lockfile changes.

The implementation commits, in dependency order, are:

1. `feat(ds160): strengthen submission contracts`
2. `feat(ds160): complete contact submission branches`
3. `fix(ds160): align social media submission`
4. `fix(ds160): complete security and additional submission flows`
5. `fix(ds160): make background submission resumable`

Review the combined PR diff first, then use the commit order above when tracing
why a contract or selector exists.

## What Works

- Canonical DS-160 answer derivation and fail-closed completeness checks cover
  the audited Travel, Travel Companions, Previous U.S. Travel, Address and
  Phone, Passport, Family, Work/Education, Social Media, and Security and
  Background paths.
- Social media follows the official repeated-row model. `NONE` is exclusive;
  real platforms require an identifier. The optional other-websites question
  has its own conditional repeated rows.
- The runner can attach only to an explicitly configured loopback Chrome CDP
  endpoint, select one unambiguous official CEAC tab, recover the matching
  stored draft, and continue from a supported form page.
- A newly created CEAC draft stores its recovery answer encrypted in both the
  applicant vault and application recovery metadata, then verifies the binding
  before filling continues.
- Recovery, page identity, application identity, official-origin gates, and
  conditional controls fail closed instead of guessing.
- The orchestrator can continue through the audited form sections and stop at a
  supported handoff state without clicking the final signature submission.

## Live QA Evidence

A sanitized assisted-live run created or recovered the same DS-160 draft and
filled through Security and Background Parts 4 and 5. It reached Upload Photo
and stopped because the selected candidate did not have an application photo
document. No final submission occurred.

This evidence proves the path through the audited text fields and controls. It
does not prove photo upload, Review, electronic signature, or final submission.

## Runtime Contract

Required server-side configuration includes:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUBMISSION_RESULT_SECRET_KEY` with at least 16 characters
- exactly one effective loopback endpoint from `CEAC_CHROME_CDP_ENDPOINT` or
  `CEAC_CDP_ENDPOINT`

If both CDP variables are set, they must resolve to the same loopback endpoint.
Only `localhost`, `127.0.0.1`, or `::1` is accepted; credentials embedded in the
endpoint are rejected. Never place real values in docs, fixtures, commands,
screenshots, issue comments, or PR descriptions.

The current assisted-live sequence is:

1. Start Chrome with a loopback remote-debugging endpoint.
2. Keep exactly one matching official CEAC form or approved resume-entry tab.
3. Complete the CEAC start-page image challenge in that browser when required.
4. Let the runner attach, verify official origin and draft identity, retrieve or
   bind the draft, and fill supported pages in the background.
5. If a compliant applicant photo is available, continue through photo upload
   and inspect the Review/Sign handoff.
6. Stop before the irreversible `Sign and Submit Application` action.

The runner must not treat a security challenge, ambiguous tab, mismatched
application, expired session, missing recovery credential, incomplete answer,
or missing required document as success.

## Safety and Privacy Boundaries

- Do not fabricate applicant facts or use real applicant data in fixtures.
- Do not print or persist plaintext recovery answers, applicant answers, portal
  credentials, secret keys, document contents, or full official identifiers.
- Do not commit browser profiles, downloaded documents, screenshots containing
  personal data, `.env` files, or diagnostic HTML from a live session.
- Keep official-origin, page-identity, application-identity, and one-tab
  ambiguity checks fail closed.
- Never click the final CEAC `Sign and Submit Application` action in automated
  QA. Review/Sign work must end at a clearly observable handoff immediately
  before that action.
- Use only a candidate-uploaded, DS-160-compliant photo. Do not synthesize,
  substitute, or reuse another person's photo.

## Verification

From `viza-be/submission-service`, install dependencies using the repository's
normal package workflow, then run:

```bash
node --import tsx --test \
  src/__tests__/ds160-derive-answers.spec.ts \
  src/__tests__/ds160-form-mappings.spec.ts \
  src/__tests__/ds160-runtime-preflight.spec.ts \
  src/__tests__/ds160-work-income-compatibility.spec.ts \
  src/ceac/__tests__/attached-new-application.spec.ts \
  src/ceac/__tests__/resume-entry.spec.ts \
  src/ceac/__tests__/security-background.spec.ts \
  src/ceac/__tests__/select-option.spec.ts \
  src/ceac/__tests__/session.spec.ts \
  src/ceac/__tests__/social-media.spec.ts \
  src/ceac/__tests__/stored-recovery.spec.ts \
  src/ceac/__tests__/travel-address-preserve.spec.ts \
  src/ceac/__tests__/travel-companions.spec.ts \
  src/ceac/__tests__/us-contact-retention.spec.ts \
  src/ceac/__tests__/work-education-additional.spec.ts
npm run type-check
git diff --check origin/main...HEAD
```

The focused suite contained 124 passing tests before the branch was rebuilt on
the latest remote base. Re-run it on this branch and require all checks to pass
before merge.

## Remaining Work

1. Review the branch against current `origin/main`, with special attention to
   the shared `src/queue/halt-runners.ts` integration.
2. Confirm CI and the focused tests above remain green.
3. Verify the deployment has the required Supabase, cipher, applicant-vault,
   and loopback CDP configuration without exposing values.
4. Add or select a candidate-uploaded compliant DS-160 photo and test the photo
   path with sanitized evidence.
5. Exercise Review and the Sign-page handoff in an authorized session, stopping
   before final submission.
6. Add regression tests for every selector or branch changed after live QA.

Known limitations:

- Legacy drafts without a saved security answer cannot be recovered
  automatically. The new-draft path saves the answer encrypted for subsequent
  runs.
- CDP attachment is loopback-only and requires one uniquely identifiable
  official CEAC tab.
- The current flow is background form filling with an assisted security
  checkpoint, not an unattended end-to-end submission across every challenge.
- Photo upload and the final Review/Sign handoff still need authorized live
  verification. Final submission remains outside automated QA.

## AI Agent Start Prompt

Use the following as the first message to the teammate's AI agent:

> Work from branch `codex/ds160-resumable-submission-20260911`. Read the root,
> submission-service, CEAC, and docs `AGENTS.md` files before editing. Review
> `docs/runners/ds160-resumable-submission-handoff.md`, inspect the combined diff
> against `origin/main`, and run the listed 124 focused tests, type-check, and
> diff check. Keep changes limited to the DS-160 submission path and its tests.
> Preserve all fail-closed official-origin, tab-identity, application-identity,
> recovery, and final-submit boundaries. Never expose real applicant data or
> secrets. Continue with candidate-provided photo upload and Review/Sign handoff
> verification only in an authorized session, and stop before the final `Sign
> and Submit Application` action. Report exact code/test evidence and any
> remaining manual or data requirement; do not claim full completion without
> live evidence for the remaining path.

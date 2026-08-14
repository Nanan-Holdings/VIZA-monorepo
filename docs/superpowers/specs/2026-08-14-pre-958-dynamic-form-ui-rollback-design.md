# Pre-958 Dynamic Form UI Rollback Design

## Context

Commit `958d69d691a993e858c5207d5bd19529403a589d` replaced the shared dynamic
application-form UI while restoring several form-behavior safeguards. The
requested outcome is to restore the frontend UI exactly to the state immediately
before that commit without reverting its submission-service changes.

## Considered Approaches

1. Restore all three frontend files from the commit's first parent. This gives
   exact pre-958 frontend content with a narrow, auditable change.
2. Restore only the two dynamic-form components. This is smaller, but leaves the
   supporting application-form primitive in a mixed post-958 state.
3. Revert the complete commit and then reapply its backend files. This reaches
   the same frontend tree with more operations and a larger conflict surface.

The selected approach is option 1.

## Scope

Restore these files byte-for-byte from `958d69d6^`, whose resolved commit is
`d55f33bc7be273dffc7c12ca971c552e84c6b68b`:

- `viza-fe/internal-website/components/dynamic-form-field.tsx`
- `viza-fe/internal-website/components/dynamic-step-form.tsx`
- `viza-fe/internal-website/components/ui/application-form-field.tsx`

Do not change:

- `viza-be/submission-service/src/uk/normalize.ts`
- `viza-be/submission-service/src/shared/__tests__/brightdata-credentials.spec.ts`
- Any other frontend, backend, migration, dependency, or documentation file as
  part of the implementation commit.

## Behavior and Data Flow

The application route continues to render `DynamicStepForm`, which renders
`DynamicFormField` and the pre-958 application-form primitive. No API contract,
database value, saved-answer format, or runner input changes. The rollback only
restores the pre-958 frontend component implementations and their visual and
interactive behavior.

## Failure Handling

- Abort before restoration if the worktree contains overlapping uncommitted
  edits in any of the three target files.
- Restore by immutable commit SHA, not by branch name, so concurrent branch
  movement cannot change the source snapshot.
- After restoration, verify every target blob matches `d55f33bc` exactly and
  verify both excluded backend files still match the current pre-rollback HEAD.
- If static checks or the route smoke fail, keep the evidence and do not claim
  the rollback is complete.

## Verification

1. Confirm the three restored file blobs equal the corresponding blobs in
   `d55f33bc`.
2. Confirm the two submission-service files are unchanged.
3. Run the focused dynamic-form tests.
4. Run frontend `npm run type-check` and `npm run lint`.
5. Smoke `/client/application` in a browser, using the authenticated route when
   credentials are available or reporting the closest reachable redirect/state.

## Commit

Record the implementation as a single scoped commit:

`revert(frontend): restore pre-958 dynamic form UI`

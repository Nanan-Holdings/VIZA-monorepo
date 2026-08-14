# Korea Shenyang Appointment Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse Korea-form and universal-profile facts for Shenyang VFS appointments, collect only unresolved required values inside the review card, save them only to the current Korea application, and leave every non-Shenyang center unchanged.

**Architecture:** Add one pure applicant-detail resolver shared by the Korea appointment API and component tests, plus a server-only loader that merges application answers over universal-profile fallbacks. `confirm-review` materializes the resolved Shenyang values into canonical application-answer rows before persisting review consent; the existing account/slots/confirm/result transitions remain unchanged. The worker adds a final fail-closed applicant-data validator before it fills the official page.

**Tech Stack:** Next.js 16 route handlers, React 19, next-intl, Supabase/PostgREST, TypeScript, Vitest/Testing Library, Node test runner, Playwright submission worker, Vercel, Fly.io.

---

## File Map

- Create `viza-fe/internal-website/lib/korea-c39/shenyang-applicant-details.ts`: pure aliases, source precedence, masking, validation, and canonical row construction.
- Create `viza-fe/internal-website/lib/korea-c39/shenyang-applicant-details.server.ts`: server-only Supabase loader for profile columns and `universal_profile_answers`.
- Create `viza-fe/internal-website/lib/korea-c39/__tests__/shenyang-applicant-details.test.ts`: resolver and validation tests.
- Modify `viza-fe/internal-website/app/api/applications/[id]/korea-appointment/route.ts`: Shenyang-only snapshot and `confirm-review` persistence.
- Modify `viza-fe/internal-website/components/client/korea-appointment/KoreaAppointmentAssistant.tsx`: Shenyang-only summary, missing-field inputs, and one CTA.
- Modify `viza-fe/internal-website/components/client/korea-appointment/KoreaAppointmentAssistant.test.tsx`: FSM/UI and request-payload coverage.
- Modify `viza-fe/internal-website/messages/zh.json` and `messages/en.json`: localized field, source, validation, and CTA copy.
- Create `viza-be/submission-service/src/korea-vfs-shenyang/applicant-details.ts`: worker-side canonical required-value validation.
- Create `viza-be/submission-service/src/korea-vfs-shenyang/applicant-details.spec.ts`: worker validator coverage.
- Modify `viza-be/submission-service/src/korea-vfs-shenyang/runner.ts`: fail closed and fill only validated values.
- Modify `viza-fe/internal-website/components/client/korea-appointment/AGENTS.md` and `viza-be/submission-service/AGENTS.md` to record the new resolver/validator responsibilities.

### Task 1: Pure Shenyang applicant resolver

**Files:**
- Create: `viza-fe/internal-website/lib/korea-c39/shenyang-applicant-details.ts`
- Create: `viza-fe/internal-website/lib/korea-c39/__tests__/shenyang-applicant-details.test.ts`

- [ ] **Step 1: Write the failing precedence and validation tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildShenyangCanonicalRows,
  resolveShenyangApplicantDetails,
  validateShenyangSupplement,
} from "@/lib/korea-c39/shenyang-applicant-details";

describe("Shenyang appointment applicant details", () => {
  it("prefers Korea answers over universal profile values", () => {
    const result = resolveShenyangApplicantDetails({
      applicationAnswers: {
        surname_en: { value: "ZHANG", origin: "korea_form" },
        given_names_en: { value: "SAN", origin: "korea_form" },
      },
      profileAnswers: { surname: "WANG", given_names: "WU" },
    });
    expect(result.fields.surname).toMatchObject({ displayValue: "ZHANG", source: "korea_form" });
    expect(result.fields.givenNames).toMatchObject({ displayValue: "SAN", source: "korea_form" });
  });

  it("falls back to universal profile and reports only unresolved required fields", () => {
    const result = resolveShenyangApplicantDetails({
      applicationAnswers: {},
      profileAnswers: {
        surname: "LI",
        given_names: "MING",
        date_of_birth: "1995-04-03",
        passport_number: "E12345678",
        passport_expiry_date: "2031-05-06",
        phone: "+86 13800138000",
      },
    });
    expect(result.complete).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.fields.passportNumber.displayValue).toBe("**** 5678");
    expect(result.fields.mobilePhone.displayValue).toBe("138****8000");
  });

  it("rejects invalid supplements with field-keyed errors", () => {
    expect(validateShenyangSupplement({
      surname: "张",
      givenNames: "SAN",
      dateOfBirth: "not-a-date",
      passportNumber: "?",
      passportExpiryDate: "2020-01-01",
      mobilePhone: "123",
    }, new Date("2026-08-14T00:00:00Z"))).toEqual(expect.objectContaining({
      surname: "latin_name_required",
      dateOfBirth: "invalid_date",
      passportNumber: "invalid_passport",
      passportExpiryDate: "passport_expired",
      mobilePhone: "invalid_mainland_phone",
    }));
  });

  it("builds canonical current-application rows without universal-profile writes", () => {
    expect(buildShenyangCanonicalRows("application-1", {
      surname: { rawValue: "ZHANG", source: "universal_profile" },
      givenNames: { rawValue: "SAN", source: "appointment_supplement" },
      dateOfBirth: { rawValue: "1995-04-03", source: "korea_form" },
      passportNumber: { rawValue: "E12345678", source: "korea_form" },
      passportExpiryDate: { rawValue: "2031-05-06", source: "universal_profile" },
      mobilePhone: { rawValue: "13800138000", source: "appointment_supplement" },
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ application_id: "application-1", field_name: "surname", value_text: "ZHANG" }),
      expect.objectContaining({ application_id: "application-1", field_name: "mobile_phone", value_text: "13800138000" }),
    ]));
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
cd viza-fe\internal-website
npx vitest run lib/korea-c39/__tests__/shenyang-applicant-details.test.ts
```

Expected: FAIL because `shenyang-applicant-details.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure contract**

```ts
export const SHENYANG_REQUIRED_FIELDS = [
  "surname", "givenNames", "dateOfBirth", "passportNumber", "passportExpiryDate", "mobilePhone",
] as const;
export type ShenyangApplicantField = (typeof SHENYANG_REQUIRED_FIELDS)[number];
export type ShenyangApplicantSource = "korea_form" | "universal_profile" | "appointment_supplement";

const ANSWER_KEYS: Record<ShenyangApplicantField, string[]> = {
  surname: ["surname_en", "surname", "family_name_en", "family_name", "last_name"],
  givenNames: ["given_names_en", "given_names", "given_name", "first_name"],
  dateOfBirth: ["date_of_birth", "dob", "birth_date", "birthday"],
  passportNumber: ["passport_number", "passport_no", "travel_document_number", "document_number"],
  passportExpiryDate: ["passport_expiry_date", "passport_expiration_date", "passport_date_of_expiry", "valid_until"],
  mobilePhone: ["mobile_phone", "phone", "phone_number", "primary_phone_number", "booker_phone"],
};

export function normalizeMainlandPhone(value: string) {
  const digits = value.replace(/\D/gu, "").replace(/^86(?=1\d{10}$)/u, "");
  return /^1\d{10}$/u.test(digits) ? digits : null;
}
```

Add the remaining exports with these exact signatures:

```ts
export interface ShenyangResolvedValue {
  rawValue: string;
  displayValue: string;
  source: ShenyangApplicantSource;
}

export interface ShenyangResolvedDetails {
  fields: Partial<Record<ShenyangApplicantField, ShenyangResolvedValue>>;
  missingFields: ShenyangApplicantField[];
  complete: boolean;
}

export function resolveShenyangApplicantDetails(input: {
  applicationAnswers: Record<string, { value: string; origin?: string | null }>;
  profileAnswers: Record<string, string>;
  supplements?: Partial<Record<ShenyangApplicantField, string>>;
}): ShenyangResolvedDetails;

export function validateShenyangSupplement(
  input: Partial<Record<ShenyangApplicantField, string>>,
  now?: Date,
): Partial<Record<ShenyangApplicantField, string>>;

export function buildShenyangCanonicalRows(
  applicationId: string,
  fields: Record<ShenyangApplicantField, ShenyangResolvedValue>,
): Array<{
  application_id: string;
  field_name: string;
  value_text: string;
  field_type: "text" | "date" | "tel";
  field_schema: { origin: ShenyangApplicantSource };
}>;
```

`resolveShenyangApplicantDetails` loops over `SHENYANG_REQUIRED_FIELDS`, checks
the alias list in `applicationAnswers`, then the alias list in
`profileAnswers`, then `supplements`. It preserves an application row's
`field_schema.origin === "appointment_supplement"`; every other application
row is `korea_form`. It masks only passport and mobile display values while
keeping raw values server-side. `validateShenyangSupplement` applies the exact
error codes asserted in Step 1. `buildShenyangCanonicalRows` maps to
`surname`, `given_names`, `date_of_birth`, `passport_number`,
`passport_expiry_date`, and `mobile_phone`, and emits no universal-profile row.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: 4 tests PASS.

- [ ] **Step 5: Commit the resolver**

```powershell
git add viza-fe/internal-website/lib/korea-c39/shenyang-applicant-details.ts viza-fe/internal-website/lib/korea-c39/__tests__/shenyang-applicant-details.test.ts
git commit -m "feat(korea-appointment): resolve Shenyang applicant details"
```

### Task 2: Server-only universal-profile fallback and application persistence

**Files:**
- Create: `viza-fe/internal-website/lib/korea-c39/shenyang-applicant-details.server.ts`
- Modify: `viza-fe/internal-website/lib/korea-c39/__tests__/shenyang-applicant-details.test.ts`
- Modify: `viza-fe/internal-website/app/api/applications/[id]/korea-appointment/route.ts`

- [ ] **Step 1: Add failing tests for server input shaping and Shenyang-only gating**

Add pure assertions for `buildUniversalProfileAnswerPatch` input shaping and
the exported non-route helper `shouldRequireShenyangApplicantDetails`:

```ts
it("enables the expanded gate only for Shenyang", () => {
  expect(shouldRequireShenyangApplicantDetails("shenyang")).toBe(true);
  expect(shouldRequireShenyangApplicantDetails("beijing")).toBe(false);
  expect(shouldRequireShenyangApplicantDetails("chengdu")).toBe(false);
});
```

Keep helpers outside `route.ts` so Next.js route type generation sees only
supported route exports.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
cd viza-fe\internal-website
npx vitest run lib/korea-c39/__tests__/shenyang-applicant-details.test.ts
```

Expected: FAIL because the Shenyang-only helper/server loader is absent.

- [ ] **Step 3: Implement the server loader**

The server module must:

```ts
import "server-only";
import { buildUniversalProfileAnswerPatch, UNIVERSAL_PROFILE_SELECT } from "@/lib/universal-profile-prefill";

type AdminClient = ReturnType<typeof createAdminClient>;

function toReusableRecord(row: {
  canonical_key: string;
  value_text: string;
  value_zh?: string | null;
  value_en?: string | null;
  source_application_id?: string | null;
  source_field_name?: string | null;
  updated_at?: string | null;
}) {
  return {
    canonicalKey: row.canonical_key,
    value: row.value_text,
    valueZh: row.value_zh,
    valueEn: row.value_en,
    sourceApplicationId: row.source_application_id,
    sourceFieldName: row.source_field_name,
    updatedAt: row.updated_at,
  };
}

export async function loadShenyangApplicantProfileFallbacks(admin: AdminClient, applicantId: string) {
  const [{ data: profile, error: profileError }, { data: reusable, error: reusableError }] = await Promise.all([
    admin.from("applicant_profiles").select(UNIVERSAL_PROFILE_SELECT).eq("id", applicantId).maybeSingle(),
    admin.from("universal_profile_answers")
      .select("canonical_key,value_text,value_zh,value_en,source_application_id,source_field_name,updated_at")
      .eq("applicant_id", applicantId)
      .order("updated_at", { ascending: false }),
  ]);
  if (profileError) throw new Error("Applicant profile could not be read.");
  const reusableAnswers = reusableError ? [] : (reusable ?? []).map(toReusableRecord);
  return buildUniversalProfileAnswerPatch({ ...(profile ?? {}), reusable_answers: reusableAnswers });
}
```

Use `isMissingSchemaFeatureError(reusableError,
["universal_profile_answers"])` to distinguish an unavailable optional table
from other query failures. The former becomes an empty fallback; the latter
throws `new Error("Reusable applicant details could not be read.")`. Never
return raw Supabase error text.

- [ ] **Step 4: Integrate the GET snapshot**

Update `readSnapshot` to resolve the center first, load universal fallbacks only
when `routing.recommended.code === "shenyang"`, and attach:

```ts
review.shenyangApplicantDetails = routing.recommended.code === "shenyang"
  ? toShenyangApplicantReviewSnapshot(resolved)
  : null;
```

No loader call, supplemental fields, or new missing-field gate may run for any
other center.

- [ ] **Step 5: Integrate Shenyang `confirm-review` persistence**

Extend the request body with:

```ts
shenyangApplicantDetails?: Partial<Record<ShenyangApplicantField, string>>;
```

When and only when `selectedCenter.code === "shenyang"`:

1. validate supplied missing values;
2. merge them over current application answers and profile fallbacks;
3. return `422` with `{ code: "shenyang_review_invalid", fieldErrors }` on format errors;
4. return `409` with `{ code: "shenyang_review_fields_required", missingFields }` if unresolved;
5. upsert canonical rows with `{ onConflict: "application_id,field_name" }`; and
6. only then call `ensureKoreaReviewJob` and write the existing consent audit.

For all non-Shenyang centers, retain the current name/mobile validation and do
not write supplemental rows. This transition must not call
`ensureSubmissionServiceReady`, `postSubmissionService`, or
`ensureFlyMachineStarted`.

- [ ] **Step 6: Run focused and type checks**

```powershell
cd viza-fe\internal-website
npx vitest run lib/korea-c39/__tests__/shenyang-applicant-details.test.ts components/client/korea-appointment/KoreaAppointmentAssistant.test.tsx
npx eslint "app/api/applications/[id]/korea-appointment/route.ts" lib/korea-c39/shenyang-applicant-details.ts lib/korea-c39/shenyang-applicant-details.server.ts
npm run type-check
```

Expected: focused tests PASS, ESLint PASS, type-check PASS. If the repository has
an unrelated pre-existing failure, record the exact file and prove these focused
files remain clean.

- [ ] **Step 7: Commit the API layer**

```powershell
git add viza-fe/internal-website/app/api/applications/[id]/korea-appointment/route.ts viza-fe/internal-website/lib/korea-c39/shenyang-applicant-details.server.ts viza-fe/internal-website/lib/korea-c39/shenyang-applicant-details.ts viza-fe/internal-website/lib/korea-c39/__tests__/shenyang-applicant-details.test.ts
git commit -m "feat(korea-appointment): persist Shenyang review details"
```

### Task 3: Shenyang-only single-card UI

**Files:**
- Modify: `viza-fe/internal-website/components/client/korea-appointment/KoreaAppointmentAssistant.tsx`
- Modify: `viza-fe/internal-website/components/client/korea-appointment/KoreaAppointmentAssistant.test.tsx`
- Modify: `viza-fe/internal-website/messages/zh.json`
- Modify: `viza-fe/internal-website/messages/en.json`

- [ ] **Step 1: Write failing component tests**

Add tests that construct a Shenyang review snapshot with two missing fields and
assert:

```ts
expectOnlyStage("review");
expect(screen.getByLabelText("护照英文姓")).toBeInTheDocument();
expect(screen.getByLabelText("中国大陆手机号")).toBeInTheDocument();
expect(screen.queryByLabelText("出生日期")).not.toBeInTheDocument();
expect(screen.getAllByRole("button", { name: "保存并确认资料" })).toHaveLength(1);
```

Fill the fields, click once, and assert the POST body contains:

```ts
expect(requestedActions()).toContainEqual(expect.objectContaining({
  action: "confirm-review",
  shenyangApplicantDetails: {
    surname: "ZHANG",
    mobilePhone: "13800138000",
  },
}));
```

Add a Beijing snapshot assertion proving none of the Shenyang labels or inputs
render and the existing CTA remains unchanged.

- [ ] **Step 2: Run the component test and verify RED**

```powershell
cd viza-fe\internal-website
npx vitest run components/client/korea-appointment/KoreaAppointmentAssistant.test.tsx
```

Expected: FAIL because the snapshot type, inputs, and payload are not present.

- [ ] **Step 3: Implement the minimal review-card UI**

Extend `KoreaAppointmentReview` with a nullable Shenyang detail snapshot. Use
one local object for currently missing inputs only:

```ts
const [shenyangDetails, setShenyangDetails] = useState<Partial<Record<ShenyangApplicantField, string>>>({});
const isShenyangReview = center?.code === "shenyang";
const shenyangMissing = isShenyangReview ? review?.shenyangApplicantDetails?.missingFields ?? [] : [];
```

Render resolved fields through `SummaryRows`, including localized source labels.
Render only `shenyangMissing` fields using existing `BrandField` and
`BrandInput`. Use `type="date"` for dates and `inputMode="tel"` for the phone.
Do not add another card, stage, banner stack, or primary action.

Use one field descriptor table so labels and input types cannot drift:

```ts
const SHENYANG_FIELD_UI: Record<ShenyangApplicantField, {
  type: "text" | "date" | "tel";
  inputMode?: "text" | "tel";
}> = {
  surname: { type: "text", inputMode: "text" },
  givenNames: { type: "text", inputMode: "text" },
  dateOfBirth: { type: "date" },
  passportNumber: { type: "text", inputMode: "text" },
  passportExpiryDate: { type: "date" },
  mobilePhone: { type: "tel", inputMode: "tel" },
};
```

Send `shenyangApplicantDetails` only when the current center is Shenyang. Clear
local supplement state when a center transition finishes so stale Shenyang
values cannot be submitted to another center.

- [ ] **Step 4: Add localized copy**

Add matching `review.shenyang.*` keys in both message files for surname, given
names, date of birth, passport number, passport expiry, mobile, Korea form,
universal profile, appointment-page source labels, validation messages, and
“保存并确认资料” / “Save and confirm details”.

- [ ] **Step 5: Run component tests and verify GREEN**

Run the command from Step 2. Expected: all Korea appointment component tests
PASS and each snapshot still renders exactly one `[data-current-stage]`.

- [ ] **Step 6: Commit the UI**

```powershell
git add viza-fe/internal-website/components/client/korea-appointment/KoreaAppointmentAssistant.tsx viza-fe/internal-website/components/client/korea-appointment/KoreaAppointmentAssistant.test.tsx viza-fe/internal-website/messages/zh.json viza-fe/internal-website/messages/en.json
git commit -m "feat(korea-appointment): collect missing Shenyang details"
```

### Task 4: Worker fail-closed applicant values

**Files:**
- Create: `viza-be/submission-service/src/korea-vfs-shenyang/applicant-details.ts`
- Create: `viza-be/submission-service/src/korea-vfs-shenyang/applicant-details.spec.ts`
- Modify: `viza-be/submission-service/src/korea-vfs-shenyang/runner.ts`

- [ ] **Step 1: Write the failing worker validator tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { requireShenyangVfsApplicantDetails } from "./applicant-details.js";

test("normalizes canonical Shenyang applicant values", () => {
  assert.deepEqual(requireShenyangVfsApplicantDetails({
    surname_en: "ZHANG",
    given_names_en: "SAN",
    date_of_birth: "1995-04-03",
    passport_number: "E12345678",
    passport_expiry_date: "2031-05-06",
    mobile_phone: "+86 13800138000",
  }), {
    surname: "ZHANG",
    givenNames: "SAN",
    dateOfBirth: "1995-04-03",
    passportNumber: "E12345678",
    passportExpiryDate: "2031-05-06",
    mobilePhone: "13800138000",
  });
});

test("fails before official applicant filling when a required value is absent", () => {
  assert.throws(() => requireShenyangVfsApplicantDetails({ surname: "ZHANG" }), /incomplete/u);
});
```

- [ ] **Step 2: Run the test and verify RED**

```powershell
cd viza-be\submission-service
node --import tsx --test src/korea-vfs-shenyang/applicant-details.spec.ts
```

Expected: FAIL because `applicant-details.ts` does not exist.

- [ ] **Step 3: Implement the worker validator and integrate it**

Add a validator with this complete public contract:

```ts
export interface ShenyangVfsApplicantDetails {
  surname: string;
  givenNames: string;
  dateOfBirth: string;
  passportNumber: string;
  passportExpiryDate: string;
  mobilePhone: string;
}

export function requireShenyangVfsApplicantDetails(
  answers: Record<string, string>,
): ShenyangVfsApplicantDetails {
  const read = (keys: string[]) => keys.map((key) => answers[key]?.trim()).find(Boolean) ?? "";
  const mobileDigits = read(["mobile_phone", "phone", "phone_number", "primary_phone_number"])
    .replace(/\D/gu, "")
    .replace(/^86(?=1\d{10}$)/u, "");
  const details = {
    surname: read(["surname_en", "surname", "family_name_en", "family_name", "last_name"]),
    givenNames: read(["given_names_en", "given_names", "given_name", "first_name"]),
    dateOfBirth: read(["date_of_birth", "dob", "birth_date", "birthday"]),
    passportNumber: read(["passport_number", "passport_no", "travel_document_number"]),
    passportExpiryDate: read(["passport_expiry_date", "passport_expiration_date", "passport_date_of_expiry", "valid_until"]),
    mobilePhone: mobileDigits,
  };
  if (Object.values(details).some((value) => !value) || !/^1\d{10}$/u.test(details.mobilePhone)) {
    throw new Error("The Shenyang VFS applicant details are incomplete.");
  }
  return details;
}
```

In `bookShenyangVfsSlot`, load canonical answers and validate them before filling:

```ts
const applicantDetails = requireShenyangVfsApplicantDetails(await loadCanonicalAnswers(input.applicationId));
await fillApplicantDetails(page, applicantDetails, account);
```

Change `fillApplicantDetails` to accept the validated object and never silently
skip a required field. Keep the VIZA alias email and account phone as the
official contact values. Do not log the object or include raw values in evidence
metadata.

- [ ] **Step 4: Run worker tests and type-check**

```powershell
cd viza-be\submission-service
node --import tsx --test src/korea-vfs-shenyang/applicant-details.spec.ts src/korea-vfs-shenyang/runner.spec.ts
npm run type-check
```

Expected: all focused tests PASS and type-check PASS.

- [ ] **Step 5: Commit the worker guard**

```powershell
git add viza-be/submission-service/src/korea-vfs-shenyang/applicant-details.ts viza-be/submission-service/src/korea-vfs-shenyang/applicant-details.spec.ts viza-be/submission-service/src/korea-vfs-shenyang/runner.ts
git commit -m "fix(korea-appointment): require Shenyang applicant details"
```

### Task 5: Integrated verification, browser smoke, and deployment

**Files:**
- Modify: `viza-fe/internal-website/components/client/korea-appointment/AGENTS.md`
- Modify: `viza-be/submission-service/AGENTS.md`

- [ ] **Step 1: Run all focused automated checks**

```powershell
cd viza-fe\internal-website
npx vitest run lib/korea-c39/__tests__/shenyang-applicant-details.test.ts components/client/korea-appointment/KoreaAppointmentAssistant.test.tsx lib/korea-c39/__tests__/kvac-routing.test.ts
npx eslint "app/api/applications/[id]/korea-appointment/route.ts" components/client/korea-appointment/KoreaAppointmentAssistant.tsx lib/korea-c39/shenyang-applicant-details.ts lib/korea-c39/shenyang-applicant-details.server.ts
npm run type-check

cd ..\..\viza-be\submission-service
node --import tsx --test src/korea-vfs-shenyang/applicant-details.spec.ts src/korea-vfs-shenyang/runner.spec.ts
npm run type-check
```

Expected: focused suites, ESLint, and both type-checks PASS.

- [ ] **Step 2: Perform authenticated local browser smoke**

At 375 px and 1440 px, open a Korea C-3-9 appointment application and verify:

1. Shenyang displays only unresolved required inputs and one current review card.
2. The save CTA is disabled until visible missing fields are locally valid.
3. Saving reloads the masked summary and advances only after persisted consent.
4. Switching to Beijing removes all Shenyang-only fields and keeps the original CTA.
5. Initial GET and saving details generate no Fly wake or submission-service request.

Stop before accepting VFS account terms. Do not create an account, send email or
SMS, query slots, or submit an appointment.

- [ ] **Step 3: Review the final diff and security boundaries**

Run:

```powershell
git diff --check HEAD~3..HEAD
git status --short
```

Confirm no secrets, raw applicant values, screenshots, `.env` files, Browserbase
URLs, OTPs, or unrelated user changes are included.

- [ ] **Step 4: Push and deploy the frontend**

Push the intended commits to `main`, deploy the clean commit to the linked
Vercel production project, wait for `Ready`, and verify the production login
page plus unauthenticated Korea appointment redirect.

- [ ] **Step 5: Deploy only the South Korea Fly worker**

After the immutable submission-service image for the final SHA is published,
dispatch `deploy-submission-service-fly.yml` with:

```text
countries=none
deploy_shared_pool=false
deploy_indonesia_worker=false
deploy_south_korea_worker=true
deploy_legacy_worker=false
```

Wait for the retained South Korea machine's rolling health checks to pass. Do
not deploy unrelated worker pools.

- [ ] **Step 6: Production safe smoke**

Verify Vercel status and the Fly deployment log. Browser-smoke only the login
page and protected-route redirect unless an authenticated test session is
already available. Do not perform VFS registration or any official-site action
without a separate explicit authorization for real applicant data.

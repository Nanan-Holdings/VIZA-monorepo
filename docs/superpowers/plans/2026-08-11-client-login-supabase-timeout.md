# Client Login Supabase Timeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent raw Supabase timeout messages from reaching applicants and make the login input borders clearly visible while preserving the existing secure auth boundary.

**Architecture:** Keep all applicant authentication behind the same-origin `/api/client/auth` route and broaden only its provider-unavailable classifier to accept safe error-shaped objects. Apply the border change locally on the login page through the shared application-control CSS variable, leaving the frozen UI primitive and its focus behavior unchanged.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.9, Supabase JS/SSR, Vitest 3, Tailwind CSS 3, Playwright CLI.

---

## File Map

- Create `viza-fe/internal-website/app/api/client/auth/route.test.ts`: focused regression coverage for plain Supabase timeout objects.
- Modify `viza-fe/internal-website/app/api/client/auth/route.ts`: safe error-name/message extraction and unavailable classification.
- Modify `viza-fe/internal-website/app/api/client/AGENTS.md`: record the focused auth route regression test.
- Modify `viza-fe/internal-website/app/client/(auth)/login/page.tsx`: route-local resting border token on email and password groups.

### Task 1: Add the Supabase Timeout Regression Test

**Files:**
- Create: `viza-fe/internal-website/app/api/client/auth/route.test.ts`
- Test: `viza-fe/internal-website/app/api/client/auth/route.test.ts`

- [ ] **Step 1: Write the failing route test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPasswordMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
    },
  })),
}));

import { POST } from "./route";

function passwordRequest(): Request {
  return new Request("http://localhost/api/client/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operation: "password",
      email: "applicant@example.com",
      password: "test-password",
    }),
  });
}

describe("POST /api/client/auth", () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
  });

  it("maps a plain Supabase timeout error to provider_unavailable", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { name: "AuthRetryableFetchError", message: "Supabase request timed out" },
    });

    const response = await POST(passwordRequest());

    await expect(response.json()).resolves.toEqual({
      success: false,
      code: "provider_unavailable",
      error: "The authentication provider is temporarily unavailable.",
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

Run from `viza-fe/internal-website`:

```powershell
npx vitest run app/api/client/auth/route.test.ts --testTimeout=15000
```

Expected: FAIL because the response contains the raw `Supabase request timed out` message and no `provider_unavailable` code.

- [ ] **Step 3: Leave production code unchanged until the red failure is recorded**

Record the exact assertion diff in the task notes before proceeding to Task 2.

### Task 2: Classify Plain Supabase Error Objects

**Files:**
- Modify: `viza-fe/internal-website/app/api/client/auth/route.ts:32-44`
- Modify: `viza-fe/internal-website/app/api/client/AGENTS.md`
- Test: `viza-fe/internal-website/app/api/client/auth/route.test.ts`

- [ ] **Step 1: Add a safe error-field reader**

Add above `isSupabaseUnavailable`:

```ts
function readErrorField(error: unknown, field: "name" | "message"): string {
  if (!error || typeof error !== "object") return "";
  const value = Reflect.get(error, field);
  return typeof value === "string" ? value : "";
}
```

- [ ] **Step 2: Replace the `instanceof Error` gate with field-based classification**

Replace `isSupabaseUnavailable` with:

```ts
function isSupabaseUnavailable(error: unknown): boolean {
  if (error instanceof SupabaseAuthUnavailableError) return true;

  const name = readErrorField(error, "name");
  const message = readErrorField(error, "message").toLowerCase();
  return (
    ["AbortError", "TimeoutError", "AuthRetryableFetchError"].includes(name) ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnreset")
  );
}
```

- [ ] **Step 3: Run the focused test and confirm green**

```powershell
npx vitest run app/api/client/auth/route.test.ts --testTimeout=15000
```

Expected: PASS with 1 test passing.

- [ ] **Step 4: Document the regression test in the nearest module guide**

Add to `viza-fe/internal-website/app/api/client/AGENTS.md`:

```markdown
`auth/route.test.ts` guards timeout/network error normalization so raw
Supabase provider failures never reach the applicant login UI.
```

- [ ] **Step 5: Commit the auth error-boundary fix**

```powershell
git add -- viza-fe/internal-website/app/api/client/auth/route.ts viza-fe/internal-website/app/api/client/auth/route.test.ts viza-fe/internal-website/app/api/client/AGENTS.md
git commit -m "fix(auth): normalize Supabase timeout failures"
```

### Task 3: Strengthen Login Input Borders

**Files:**
- Modify: `viza-fe/internal-website/app/client/(auth)/login/page.tsx:325,341`

- [ ] **Step 1: Confirm the Playwright CLI prerequisite**

```powershell
Get-Command npx
```

Expected: command information for `npx.cmd`.

- [ ] **Step 2: Record the failing computed-style baseline**

With `npm run dev` serving `http://127.0.0.1:3000`, open the login page through Playwright CLI and inspect the parent input group's computed `borderColor`.

```powershell
npx --yes --package @playwright/cli playwright-cli open http://127.0.0.1:3000/client/login
npx --yes --package @playwright/cli playwright-cli eval "() => getComputedStyle(document.querySelector('input[name=email]').closest('[role=group]')).borderColor"
```

Expected red baseline: `rgb(232, 232, 232)`, which does not match the required `brand-300` value `rgb(122, 157, 206)`.

- [ ] **Step 3: Apply the route-local brand border token**

Change both email and password groups to:

```tsx
<ApplicationFormInputGroup
  className="h-12 [--application-control-border-color:theme(colors.brand.300)]"
  filled={Boolean(email)}
  forceWhiteBackground
>
```

Use `filled={Boolean(password)}` for the password group. Do not edit `components/ui/application-form-input.tsx` or global application-control CSS.

- [ ] **Step 4: Verify resting and focused computed styles**

Reload the Playwright page, inspect the email group, focus the email input, and inspect again.

```powershell
npx --yes --package @playwright/cli playwright-cli reload
npx --yes --package @playwright/cli playwright-cli eval "() => getComputedStyle(document.querySelector('input[name=email]').closest('[role=group]')).borderColor"
npx --yes --package @playwright/cli playwright-cli eval "() => { document.querySelector('input[name=email]').focus(); return getComputedStyle(document.querySelector('input[name=email]').closest('[role=group]')).borderColor }"
```

Expected: resting `rgb(122, 157, 206)` (`brand-300`), focused `rgb(3, 52, 110)` (`brand-500`).

- [ ] **Step 5: Capture the visual state**

```powershell
npx --yes --package @playwright/cli playwright-cli screenshot --filename output/playwright/client-login-border.png
```

Expected: email and password controls have continuous, clearly visible borders with no cropped autofill edges.

- [ ] **Step 6: Commit the border fix**

```powershell
git add -- "viza-fe/internal-website/app/client/(auth)/login/page.tsx"
git commit -m "fix(auth): strengthen login input borders"
```

### Task 4: Verify the Complete Fix

**Files:**
- Verify: `viza-fe/internal-website/app/api/client/auth/route.ts`
- Verify: `viza-fe/internal-website/app/api/client/auth/route.test.ts`
- Verify: `viza-fe/internal-website/app/client/(auth)/login/page.tsx`

- [ ] **Step 1: Run the focused regression test**

```powershell
npx vitest run app/api/client/auth/route.test.ts --testTimeout=15000
```

Expected: all focused tests pass.

- [ ] **Step 2: Run the full frontend test suite**

```powershell
npm run test -- --run
```

Expected: exit code 0 with no failing tests.

- [ ] **Step 3: Run static checks**

```powershell
npm run type-check
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 4: Smoke the real local auth boundary**

Post a non-user probe credential to the local route and verify that a still-unhealthy hosted Auth service produces the controlled response:

```powershell
$body = @{
  operation = "password"
  email = "codex-timeout-probe@example.invalid"
  password = "not-a-real-password"
} | ConvertTo-Json -Compress
Invoke-RestMethod `
  -Uri "http://127.0.0.1:3000/api/client/auth" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Expected during the current provider outage: `{ success: false, code: "provider_unavailable", error: "The authentication provider is temporarily unavailable." }`. If Supabase Auth has recovered, an invalid-credentials response is also acceptable and proves the route reached the provider.

- [ ] **Step 5: Verify the localized browser error**

Submit the same non-user probe through the Chinese login page. Expected: the error is localized and does not contain `Supabase request timed out`.

- [ ] **Step 6: Review repository state**

```powershell
git status --short
git diff --check
```

Expected: only the user's pre-existing Korea appointment/message changes remain unstaged; no secrets or browser artifacts are tracked.

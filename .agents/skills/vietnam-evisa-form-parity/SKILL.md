---
name: vietnam-evisa-form-parity
description: Align, debug, or extend VIZA Vietnam e-Visa form parity with the official Vietnam e-Visa portal. Use when working on Vietnam e-Visa dynamic form schema, bilingual Chinese/English field rendering, ward/commune and border-gate dropdown localization, conditional official fields, uploaded photo/passport validation, submission-service answer mapping, official payment checkpoint UI, or end-to-end browser smoke tests for /client/application/long-form?country=vietnam&visaType=evisa_tourism.
---

# Vietnam e-Visa Form Parity

Use this skill to keep VIZA's Vietnam e-Visa user journey aligned with the
official Vietnam e-Visa portal while preserving VIZA's bilingual form contract.

## Core Principles

- Preserve official values. Localize labels for users, but keep `value`,
  `official_label`, and submission mappings compatible with the official portal.
- Prefer official-source data. Use the Vietnam portal API, observed portal DOM,
  screenshots, and submission logs before inventing schema behavior.
- Make parity resilient in two layers:
  - DB migrations/seeds for durable schema.
  - Runtime safety net in `lib/vietnam-evisa-form-parity.ts` when local DB is not migrated.
- Do not trust screenshots alone. Verify with browser or Playwright from the
  user's click path whenever possible.
- Never store card numbers, CVV, OTP, 3DS, service-role keys, or applicant
  documents in repo files, logs, traces, or skills.

## Read First

Before editing, read the nearest `AGENTS.md` and these files as relevant:

- `viza-fe/internal-website/AGENTS.md`
- `viza-fe/internal-website/frontend.md`
- `viza-fe/internal-website/components/dynamic-step-form.tsx`
- `viza-fe/internal-website/components/dynamic-form-field.tsx`
- `viza-fe/internal-website/lib/vietnam-evisa-form-parity.ts`
- `viza-fe/internal-website/lib/vietnam-administrative-units.ts`
- `viza-fe/internal-website/app/client/documents/document-center-client.tsx`
- `viza-fe/internal-website/app/actions/face-match.ts`
- `viza-be/submission-service/AGENTS.md`

## Implementation Pattern

1. Trace the failing user-visible field to its source:
   - DB field row / migration.
   - Runtime patch in `lib/vietnam-evisa-form-parity.ts`.
   - Dynamic render path in `components/dynamic-step-form.tsx`.
   - Primitive render path in `components/dynamic-form-field.tsx`.
   - Submission-service answer mapping, if the issue appears only during official automation.

2. Keep conditional official fields adjacent to their trigger:
   - Use `displayOrder` decimals for runtime parity patches.
   - Use `conditionalLogic` for `yes` / `other` cases.
   - Put generated tables immediately after the question that reveals them, not at tab end.

3. Localize option display without changing submission values:
   - For ward/commune options, localize `label_zh` and final `text` for the Chinese side.
   - Keep `value`, `label_en`, and `official_label` stable.
   - If official data has duplicate option values, do not alter saved value unless the mapper is updated. Use unique React render keys instead.

4. Normalize Vietnam administrative units:
   - Display units after the place name: `保禄第1坊`, `清安公社`, `某地市镇`.
   - Handle all source shapes:
     - `Phường 1 Bảo Lộc`
     - `1 BAO LOC WARD`
     - `坊 1 Bảo Lộc`
     - `THANH AN COMMUNE`
   - Use deterministic phrase mappings for known Vietnamese places, then a
     Vietnamese-syllable transliteration fallback so Chinese UI does not expose
     raw Latin names.

5. Localize border gates the same way:
   - Translate known airport, seaport, landport, and border-gate names with a dictionary.
   - Apply generic terms such as `International`, `Airport`, `Seaport`,
     `Landport`, `Border Gate`, `Port`, and `province`.
   - Run the Vietnamese place-name fallback on remaining Latin fragments.

6. Mirror official validations:
   - Visa start date cannot be before current date.
   - Visa end date cannot be before start date.
   - Passport expiry must exceed visa end/issuance requirements by the official buffer.
   - Passport type `Other` requires specify.
   - Insurance `Yes` requires specify.
   - Expense coverage may reveal payment method or company details.
   - Child travelers require photos when official portal requires them.

7. Photo and passport upload parity:
   - Require portrait and passport data-page images for Vietnam e-Visa.
   - Reject files over 2MB before official submission.
   - Check that faces are detectable and comparable.
   - Display an official-like comparison panel with requirements and similarity score.
   - Use `OPENAI_API_KEY` / `FACE_MATCH_OPENAI_API_KEY` only through server-side actions.

8. Submission-service parity:
   - If official automation stalls, inspect logs and screenshots before changing schema.
   - When a user-provided answer fails official validation, add a schema/default rule so
     future user input cannot reach the worker in that invalid shape.
   - For CAPTCHA, use the configured TWOCAPTCHA path when supported.
   - For payment, stop at manual/3DS/OTP checkpoints unless an explicit approved controlled
     payment path exists.

## Verification Checklist

Run focused checks for changed packages:

```powershell
cd viza-fe\internal-website
npm run type-check
npx eslint components/dynamic-step-form.tsx components/dynamic-form-field.tsx lib/vietnam-evisa-form-parity.ts
```

For submission-service changes:

```powershell
cd viza-be\submission-service
npm run type-check
```

Smoke from the user's path:

1. Open `/client/application/long-form?country=vietnam&visaType=evisa_tourism`.
2. Verify no `Invalid time value` or duplicate React key warnings.
3. Select province/city and open ward/commune:
   - Chinese side shows Chinese only.
   - Administrative unit is suffix-form.
   - English side keeps official/English value.
4. Open entry and exit border-gate dropdowns:
   - Chinese side is fully Chinese/localized.
   - Official values still submit.
5. Toggle each official conditional question to `Yes` or `Other` and verify follow-up fields appear immediately below the trigger.
6. Upload portrait/passport images and verify the Vietnam photo comparison UI.
7. Click through the form until the confirmation/submission/payment checkpoint and preserve screenshots/logs as evidence.

## Common Failure Modes

- **Chinese option still contains Latin text**: the option likely bypassed the
  Vietnam-specific localization helper or `text` is overriding `label_zh`.
- **`坊` / `公社` appears before the place name**: normalize final Chinese text
  after all localization layers, not only at the first translation point.
- **Duplicate React key warning**: official data can contain duplicate `value`.
  Use a render key based on `value + text + index`; do not change saved values casually.
- **Change visible in code but not browser**: restart `next dev`, hard refresh,
  and confirm Turbopack compiled the touched module.
- **Official worker fails after frontend validation passes**: check the official
  screenshot and submission-service logs, then back-propagate the missing rule into
  VIZA schema/runtime parity.

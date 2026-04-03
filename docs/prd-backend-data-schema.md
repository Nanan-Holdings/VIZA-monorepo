# PRD: VIZA Backend Data Schema & Multi-Visa Architecture

**Version:** 1.0  
**Date:** 2026-04-04  
**Author:** Michael (AI)  
**For:** Ralph (autonomous dev agent)  
**Status:** Ready for implementation

---

## 1. Overview

VIZA is a visa application concierge platform. The frontend portal is largely built. This PRD covers the backend data schema and API layer needed to support:

1. **Multi-visa dynamic form rendering** — each visa type has its own unique field set, driven by DB rows, not hardcoded components
2. **User visa package / plan** — each user is attached to an ongoing visa package (which visa they are applying for, purchased via a plan)
3. **Cross-visa profile reuse** — shared personal data (name, DOB, passport) is stored once and auto-filled into new visa applications
4. **Admin portal user management** — an admin page to view each Supabase user with their attached visa package
5. **US DS-160 submission path** — Playwright fills ceac.state.gov, saves the application, and returns an Application ID + retrieval link to the user so they can review and submit themselves

---

## 2. Current State Summary

### What exists
- `applicant_profiles` — shared personal/passport data per user
- `applications` — one row per application, `country` + `visa_type` columns, hardcoded to Indonesia B211A
- `visa_form_fields` — dynamic field definitions per `visa_type`, seeded for B211A and DS-160
- DS-160 extension tables — `ds160_other_names`, `ds160_social_media`, `ds160_previous_employers`, etc.
- `submission_queue` — Indonesia B211A Playwright submission pipeline
- Application wizard page — hardcoded 6-step flow for Indonesia only, not yet driven by `visa_form_fields`

### What is missing
- No `visa_packages` / `user_packages` table — no way to associate a user with the visa they are purchasing
- Application wizard is not dynamically driven by `visa_form_fields` rows
- No admin UI showing user + their attached visa package
- No DS-160 submission path
- No cross-visa prefill logic wired into the wizard
- No generic answer storage for arbitrary visa fields (current `applications` table is Indonesia-specific)

---

## 3. Scope

This PRD covers:
- Database schema changes and new tables
- Supabase migrations
- Backend API endpoints (new routes in `viza-be/agent-backend`)
- Admin portal page (new page in `viza-fe/internal-website/app/admin`)
- Submission service extension for DS-160
- Drizzle schema updates

NOT in scope: frontend wizard UI changes, payment/billing integration.

---

## 4. Data Schema

### 4.1 New Table: `visa_packages`

Defines the product catalogue.

```sql
CREATE TABLE visa_packages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  country       TEXT NOT NULL,
  visa_type     TEXT NOT NULL,
  description   TEXT,
  price_usd     NUMERIC(10,2),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country, visa_type)
);
```

Seed data at migration time:
- `("Indonesia Tourist B211A", "indonesia", "tourist_b211a")`
- `("US Tourist B1/B2 (DS-160)", "us", "ds160_b1b2")`

---

### 4.2 New Table: `user_packages`

Associates a user with an ongoing visa package.

```sql
CREATE TABLE user_packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id        UUID NOT NULL REFERENCES visa_packages(id),
  status            TEXT NOT NULL DEFAULT 'active',
  application_id    UUID REFERENCES applications(id),
  purchased_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
-- status values: active | completed | cancelled | paused
CREATE INDEX user_packages_auth_user_idx ON user_packages(auth_user_id);
CREATE INDEX user_packages_status_idx ON user_packages(auth_user_id, status);
```

RLS:
- Users read their own: `auth_user_id = auth.uid()`
- Service role: full access
- Admin users: read all rows

---

### 4.3 New Table: `visa_application_answers`

Generic key-value answer storage per application. Replaces hardcoded columns for new visa types.

```sql
CREATE TABLE visa_application_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field_name      TEXT NOT NULL,
  value_text      TEXT,
  value_json      JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(application_id, field_name)
);
CREATE INDEX visa_answers_application_idx ON visa_application_answers(application_id);
CREATE INDEX visa_answers_field_idx ON visa_application_answers(application_id, field_name);
```

Indonesia B211A continues using existing `applications` columns. New visa types use this table.

---

### 4.4 Changes to `applications` table

```sql
ALTER TABLE applications ADD COLUMN visa_package_id UUID REFERENCES visa_packages(id);
ALTER TABLE applications ADD COLUMN ds160_application_id TEXT;
ALTER TABLE applications ADD COLUMN ds160_retrieval_url TEXT;
ALTER TABLE applications ADD COLUMN ds160_dat_storage_path TEXT;
```

---

### 4.5 New Table: `shared_profile_fields`

Tracks completeness of shared profile field groups for cross-visa prefill.

```sql
CREATE TABLE shared_profile_fields (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id    UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  field_group     TEXT NOT NULL,
  is_complete     BOOLEAN NOT NULL DEFAULT false,
  last_verified   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(applicant_id, field_group)
);
-- field_group values: personal | passport | contact | employment | travel_history
```

---

### 4.6 Drizzle Schema Updates

Add to `viza-be/agent-backend/src/db/schema.ts`:
- `visaPackages`
- `userPackages`
- `visaApplicationAnswers`
- `sharedProfileFields`

Add columns to `applications` table definition:
- `visaPackageId`
- `ds160ApplicationId`
- `ds160RetrievalUrl`
- `ds160DatStoragePath`

Also add new field_type values to `visa_form_fields` documentation:
- `multi_select` — multi-select with options array
- `repeatable_group` — repeating row group (DS-160 employers, relatives, etc.)

---

## 5. API Endpoints

New routes in `viza-be/agent-backend/src/routes/`.

### 5.1 GET /api/user/package
Returns active visa package for authenticated user.

```json
{
  "package": {
    "id": "uuid",
    "name": "US Tourist B1/B2 (DS-160)",
    "country": "us",
    "visaType": "ds160_b1b2",
    "status": "active",
    "applicationId": "uuid | null",
    "purchasedAt": "ISO"
  }
}
```
Returns `{ "package": null }` if no active package.

### 5.2 POST /api/user/package (service-role only)
Assigns a visa package to a user. If user already has active package, sets old one to "paused".
Body: `{ "authUserId": "uuid", "packageId": "uuid" }`

### 5.3 GET /api/applications/:id/answers
Returns all answers for an application as flat key-value map.
```json
{ "answers": { "field_name": "value", ... } }
```

### 5.4 POST /api/applications/:id/answers
Upserts answers. Uses ON CONFLICT DO UPDATE.
Body: `{ "answers": { "field_name": "value", ... } }`

### 5.5 GET /api/profile/prefill?visaType=ds160_b1b2
Returns applicant_profiles data pre-mapped to the given visa type's field names.
```json
{
  "prefill": { "full_name": "Zhang Zehua", "passport_number": "E12345678", ... },
  "completeness": { "personal": true, "passport": true, "contact": false }
}
```

### 5.6 GET /api/admin/users (admin only)
Returns all Supabase users with active visa package attached.
Uses `supabase.auth.admin.listUsers()` joined with `user_packages` + `visa_packages`.

---

## 6. Admin Portal — User Management Page

### 6.1 Location
`viza-fe/internal-website/app/admin/users/page.tsx`

### 6.2 User list table shows
- Email, full name, current active visa package (name + country), application status, signup date
- "Assign Package" button per row

### 6.3 Assign Package modal
- Dropdown: select from `visa_packages` rows
- Confirm calls `POST /api/user/package`

### 6.4 User detail page
`viza-fe/internal-website/app/admin/users/[id]/page.tsx`

Shows:
- Full `applicant_profiles` data
- All `user_packages` history
- Current `applications` row with status
- Document checklist (6 docs)
- Read-only table of `visa_application_answers`

### 6.5 Access control
Follows existing `lib/rbac.ts` pattern used by other admin pages.

---

## 7. Dynamic Form Field Architecture

The frontend wizard must be driven entirely by `visa_form_fields` rows — no hardcoded steps.

### 7.1 Steps
One step per unique `step_number`, fields rendered in `display_order` order.

### 7.2 Field types

| field_type | UI |
|---|---|
| text | Input |
| textarea | Textarea |
| select | Select with options array |
| date | DatePicker |
| file | FileUploadCard |
| radio | Radio group with options |
| checkbox | Checkbox + explanation textarea (DS-160 security) |
| multi_select | Multi-select from options |
| repeatable_group | Repeating row group |

### 7.3 repeatable_group fields

For DS-160 multi-row fields (employers, relatives, etc.), the visa_form_fields row should have:

```json
{
  "field_type": "repeatable_group",
  "field_name": "previous_employers",
  "validationRules": { "table": "ds160_previous_employers", "minRows": 0, "maxRows": 5 },
  "options": [
    { "value": "employer_name", "text": "Employer Name", "type": "text" },
    { "value": "job_title", "text": "Job Title", "type": "text" },
    { "value": "start_date", "text": "Start Date", "type": "date" }
  ]
}
```

Repeatable group data saved to DS-160 extension tables, not `visa_application_answers`.

### 7.4 Answer save strategy

| Field category | Save to |
|---|---|
| Simple text/select/date/textarea | `visa_application_answers.value_text` |
| Multi-value (checkboxes, multi-select) | `visa_application_answers.value_json` |
| Repeatable groups | DS-160 extension tables |
| Shared personal/passport fields | `applicant_profiles` (primary) + `visa_application_answers` (copy) |

---

## 8. DS-160 Submission Service

### 8.1 Overview

DS-160 uses ceac.state.gov — no public API. VIZA uses Playwright to pre-fill the form, saves the application (Application ID + .dat file), then returns a retrieval link to the user. The user reviews and clicks Submit themselves — they are legally responsible for the accuracy.

### 8.2 Flow

```
1. User completes DS-160 fields in VIZA portal
2. User clicks "Pre-fill DS-160 for me" (after confirming legal disclaimer)
3. Backend enqueues submission_queue row with status = "ds160_prefill_pending"
4. submission-service picks up the job
5. Playwright opens ceac.state.gov → starts new application
6. Playwright fills all pages from:
   - applicant_profiles (personal/passport)
   - visa_application_answers (travel, family, US contact)
   - ds160_* extension tables (employers, relatives, social media, security)
7. Playwright clicks "Save Application to File" → downloads .dat file
8. Playwright records the Application ID shown on screen
9. Service uploads .dat to Supabase Storage: ds160-saves/{applicationId}.dat
10. Service updates applications row:
    - ds160_application_id = "AA00123456"
    - ds160_retrieval_url = "https://ceac.state.gov/genniv/?id=AA00123456"
    - ds160_dat_storage_path = "ds160-saves/{applicationId}.dat"
    - status = "ds160_prefilled"
11. User notified via Telegram + in-app:
    "Your DS-160 has been pre-filled. Application ID: AA00123456.
     Review and submit here: [link]"
```

### 8.3 New submission_queue statuses

| Status | Meaning |
|---|---|
| ds160_prefill_pending | Queued for Playwright pre-fill |
| ds160_prefill_processing | Playwright running |
| ds160_prefilled | Done — Application ID returned to user |
| ds160_prefill_failed | Failed after 3 attempts |
| ds160_submitted | User confirmed they submitted on ceac.state.gov |

### 8.4 Implementation files

New files in `viza-be/submission-service/src/`:
- `ds160-prefill.ts` — main Playwright automation
- `ds160-field-mappings.ts` — ceac.state.gov selector map per section
- `index.ts` — updated to handle both Indonesia and DS-160 job types

### 8.5 DS-160 section → data source mapping

| DS-160 Section | Data Source |
|---|---|
| Personal Info 1 (name, DOB, nationality) | applicant_profiles |
| Personal Info 2 (other names, gender) | applicant_profiles + ds160_other_names |
| Address & Phone | applicant_profiles |
| Passport | applicant_profiles |
| Travel Info (purpose, dates, US address) | visa_application_answers |
| Travel Companions | ds160_travel_companions |
| Previous US Travel | visa_application_answers |
| US Contact Person | visa_application_answers |
| Family Info (father/mother/spouse) | visa_application_answers |
| Work/Education (current) | applicant_profiles.occupation |
| Previous Employers | ds160_previous_employers |
| Security Questions (37 yes/no) | ds160_security_answers |
| Social Media | ds160_social_media |

### 8.6 Error handling

- ceac.state.gov down or CAPTCHA detected: fail immediately, operator alert
- Individual field error: log and skip with empty value, continue
- 3 total failures: Resend alert to edward.zehua.zhang@gmail.com

### 8.7 Legal disclaimer (frontend)

Before triggering DS-160 pre-fill, show confirmation modal:
> "VIZA will pre-fill your DS-160 based on your information. You are responsible for reviewing all answers before submitting to the US government. Do not submit if any information is incorrect."

User must click "I understand, pre-fill my DS-160" to proceed.

---

## 9. Migrations Plan

| File | Content |
|---|---|
| 0006_visa_packages.sql | Create visa_packages, user_packages + seed data |
| 0007_application_answers.sql | Create visa_application_answers, shared_profile_fields |
| 0008_applications_ds160_columns.sql | Add visa_package_id, ds160_* columns to applications |
| 0009_rls_policies.sql | RLS for all new tables |

---

## 10. User Stories for Ralph

### US-016: Visa packages schema
Create visa_packages and user_packages tables with migrations + Drizzle schema + seed data + RLS.
Scope: viza-be/agent-backend/src/db/schema.ts, viza-be/agent-backend/drizzle/
Priority: 16

### US-017: Generic answer storage + DS-160 columns
Create visa_application_answers and shared_profile_fields. Add ds160/package columns to applications.
Scope: viza-be/agent-backend/src/db/schema.ts, viza-be/agent-backend/drizzle/
Priority: 17

### US-018: User package + answer API endpoints
All 5 endpoints from section 5 + auth middleware. Typecheck passes.
Scope: viza-be/agent-backend/src/routes/
Priority: 18

### US-019: Admin users page + user detail page
User list table + assign package modal + detail page. Follows existing admin page patterns.
Scope: viza-fe/internal-website/app/admin/users/
Priority: 19

### US-020: DS-160 submission service
Full Playwright automation for ceac.state.gov pre-fill. All statuses handled. .dat upload. Alerts.
Scope: viza-be/submission-service/
Priority: 20

### US-021: DS-160 form fields seed (updated)
Full seed for all DS-160 sections including repeatable_group types. Idempotent upsert.
Scope: viza-be/agent-backend/scripts/seed-ds160-form-fields.ts
Priority: 21

---

## 11. Out of Scope

- Frontend dynamic wizard UI (separate PRD)
- Billing/Stripe for package purchase
- England/UK visa type
- DS-160 photo upload automation (user uploads photo themselves on ceac.state.gov)
- CAPTCHA solving (CAPTCHA = immediate failure + operator alert)

---

## 12. Open Questions

1. **Package assignment in production**: Manual admin assignment for now. Will there be a Stripe webhook eventually?
2. **Multiple concurrent packages**: Can a user have Indonesia + US active simultaneously? Current model allows it.
3. **DS-160 photo**: User must upload their own photo on ceac.state.gov. VIZA should remind them.

# Application Schema to UI Contract

Status: implemented and audited on 2026-08-16.

This contract is the boundary between scraped official-form schemas in
`visa_form_fields` and the frozen application controls demonstrated at
`/ui-components`. The renderer must not decide panel ownership independently
for each child field. The schema compiler resolves that ownership once for the
whole visa type.

## Canonical mapping

| Schema field | Canonical application component |
| --- | --- |
| `text`, `email`, `tel`, `number` | application input |
| `password` or `sensitive: true` | excluded from applicant-facing steps; VIZA owns portal credentials and sessions |
| `textarea` | application textarea |
| `date` | application date picker |
| short `select` | application select |
| large, remote, or inferred phone-code `select` | searchable select |
| `select` with `source: ISO3166-1` | country dropdown |
| `select` with `source: US_STATES` | US region select |
| `multi_select` | searchable multi-select |
| two-option `radio` | segmented two-choice control |
| radio with 3–11 options | vertical radio group |
| radio with 12 or more options | searchable selector |
| `checkbox` | application checkbox |
| `country` | country dropdown |
| `file` with `document_slot` | supporting-document card contract, not a persisted file-path answer |

Unknown field types fail the strict audit. They are never silently rendered as
a text input.

## Conditional panel invariant

For a conditional multi-option group, one controller owns at most one panel:

1. Resolve every visible child's complete `showIf` dependency chain to its
   terminal option controller.
2. When controller and children are in the same step, annotate every child
   with the same `ui_conditional_panel_controller` and `shared` panel mode.
3. Render all active descendants inside that one panel immediately below the
   controller. Nested conditional descendants remain in the terminal
   controller's panel; they do not create another border.
4. Cross-step, compound-root, unparseable, forward, and non-option-controller
   branches use `outer_only` mode. They remain conditionally visible but do not
   invent an orphan nested panel. Cross-step branches are supported; a
   section-level branch may also hide its step in the application sidebar.
5. Repeat groups retain one panel per repeated item because add/remove behavior
   is structural, not merely visual.

This rule covers both segmented/radio controllers and dropdown controllers. It
is the fix for the duplicated panel seen in UK purpose details and the separate
national-ID child panels.

## Automatic processing for new countries

`getVisaFormSteps()` runs `compileApplicationSchemaForUi()` after country
parity and bilingual normalization. The compiler:

- attaches the canonical `ui_component` to every in-memory field;
- filters official-portal passwords, OTPs, and other sensitive fields from all
  applicant-facing steps;
- resolves shared conditional-panel ownership across the complete visa schema;
- falls back to the outer step card for conditional shapes without one safe
  owner;
- recognizes explicit static, remote, and dependent option sources;
- safely infers built-in country, US-state, and phone-country-code adapters;
- reuses one unambiguous sibling option list when a scraped semantic variant
  explicitly names, or clearly resolves to, the canonical field;
- reports malformed schemas and design-only edge cases without changing stored
  applicant answers.

Every new or refreshed country schema must pass:

```bash
cd viza-fe/internal-website
npm run qa:audit-schema-ui -- --visa-type=<VISA_TYPE> --strict
```

Run `npm run qa:audit-schema-ui -- --summary --strict` for the whole master
schema. `--json` produces machine-readable reports. A strict error is a launch
blocker; warnings and guidance require an explicit schema correction or design
decision.

## Master-schema audit snapshot

The 2026-08-16 live audit covered 21 visa types and 1,994 fields. After
deterministic normalization it reported zero errors, 20 warnings, 205 guidance
items, and zero unresolved design-edge-case instances. Eleven compound-root
conditions remain implementation guidance across three schemas, using the
approved `/ui-components` pattern. No live field type was unsupported.

The three safe repairs applied at load time were:

- Taiwan father occupation options reused from `current_occupation`;
- Taiwan mother occupation options reused from `current_occupation`;
- one missing `phone_country_code` option source mapped to the built-in phone
  country-code list.

These repairs should still be persisted in future schema refreshes as
`option_source_field` or `source`; the audit keeps guidance visible until the
master rows are explicit.

## Complete edge-case component backlog

The list below distinguishes current audited shapes from scraped controls that
are deliberately blocked until a component contract exists.

| Edge case | Current behavior | Design/component decision needed |
| --- | --- | --- |
| Same-step multi-option branch | One shared conditional panel | Covered by the frozen conditional group pattern |
| Nested branch under the same terminal controller | Remains in the shared parent panel | Decide whether deep branches ever need internal headings, never another generic border |
| Cross-step condition | Conditional visibility with outer step card; section-level branches may drive sidebar visibility | Covered |
| Compound condition with multiple terminal controllers (11 fields) | Outer-only | Approved compound conditional group is documented at `/ui-components`; runtime compiler/renderer integration remains pending |
| Conditional repeat group | One structural panel per item | Nested-repeat and mixed-controller pattern if a future schema requires either |
| Text/date/calculated controller | Outer-only | Derived/read-only controller and dependency-ownership pattern |
| Forward dependency | Strict error | No component; reorder or correct the schema |
| Any two radio options | Segmented two-choice control | Covered; semantic values do not change the visual mapping |
| 3–11 radio options | Vertical radio group | Covered |
| 12 or more radio options | Searchable selector | Covered; threshold is shared with large selects |
| Checkbox representing one boolean | Application checkbox | Covered |
| Multiple checkbox choices stored as a set | Currently modeled via repeated checkbox/repeat metadata | Dedicated checkbox-group component with exclusive “None/Other” behavior |
| Static, remote, or dependent select | Loaded from declared adapter | Loading, empty, stale-session, retry, and parent-reset states must remain canonical |
| Cascading country/region/city/ward/hotel data | Dependent select adapters | General cascading-location component instead of country-specific renderer branches |
| Duplicate visible labels with distinct official IDs | Values remain identity | Searchable select must show disambiguating secondary text and persist the official ID |
| Country-restricted list | Country dropdown with allowed codes | Covered for Schengen; expose a schema-level allowed-country contract |
| Phone country code plus local number | Separate controls/fallback | Composite international-phone component if one visual field is desired |
| Amount plus currency or number plus unit | Inline schema group | Composite amount/unit component with official value serialization |
| Partial/unknown date, year-only date, or “does not apply” | Date plus schema flags/side checkbox | General partial-date component with explicit persisted precision |
| Any number of inline fields | One equal-width row; long labels wrap inside their column | Covered |
| Duplicate `display_order` (7 audited collisions) | Stable input order is not guaranteed | No component; correct the master schema order |
| File field without `document_slot` | Strict schema error; launch is blocked | Add the owning `application_documents` slot; upload state, replacement, OCR, reuse, and server-side identity belong in Document Center/card |
| Password, OTP, or TOTP secret | Removed by the compiler before applicant rendering | VIZA-managed portal account/session flow; never show or persist it as an applicant answer |
| Official static notice (`static_notice`) | Not present in live DB; strict failure if imported | Information/alert block with provenance and conditional visibility |
| Official legal statement (`static_statement`) | Not present in live DB; strict failure if imported | Read-only legal statement component, explicitly not a checkbox |
| Drawn signature (`signature_pad`) | Not present in live DB; strict failure if imported | Signature canvas with consent, clear/redraw, accessibility, and secure artifact contract |
| Non-answer confirmation gate (`confirmation_gate`) | Not present in live DB; strict failure if imported | Modal/step gate that does not persist as an applicant field |
| Derived portal state such as calculated age or selected-port flow | Expression is not accepted as an ordinary field unless declared | Typed derived-value registry with provenance, evaluation timing, and non-answer persistence boundary |
| Unsupported condition grammar or missing controller | Strict error and outer-only safety fallback | Extend the expression grammar only with tests and a typed derived adapter |
| “Other, specify” branch | Shared controller panel | Covered; option identity and clearing stale hidden answers must remain tested |
| Do-not-know / does-not-apply overrides | Input/date side checkbox metadata | Covered for current controls; define precedence if both flags appear together |
| Read-only value populated by lookup/OCR | Disabled display/control today | Canonical derived/read-only field with refresh and manual-override policy |
| Official option list unavailable behind a session | Remote adapter may show empty/loading state | Evidence-aware unavailable state; do not present an incomplete list as complete |

## Ownership

- Compiler and validator: `viza-fe/internal-website/lib/application-schema-ui-contract.ts`
- Runtime integration: `viza-fe/internal-website/app/actions/visa-form-fields.ts`
- Conditional rendering: `viza-fe/internal-website/components/dynamic-step-form.tsx`
- Primitive mapping: `viza-fe/internal-website/components/dynamic-form-field.tsx`
- Audit CLI: `viza-fe/internal-website/scripts/audit-application-schema-ui.ts`
- Schema authoring process: `docs/visa-schema-playbook.md`

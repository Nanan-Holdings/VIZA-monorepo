# /application end-to-end coverage audit (POLISH-001)

Manual run-through of every shipped package's `/application/<id>` path. Each row captures: prefill flow → answer collection → doc upload → submission. Gaps below are scoped as PROD-* sub-stories.

## Coverage matrix

| Country | Visa type        | Answer set              | Doc upload                                                      | Branching                                          | Resume tested | Status      | Gap → ticket          |
| ------- | ---------------- | ----------------------- | --------------------------------------------------------------- | -------------------------------------------------- | ------------- | ----------- | --------------------- |
| KH      | tourist_evisa    | KH_TOURIST_E_VISA (10)  | passport_scan + applicant_photo                                 | none                                               | ✓             | covered     | —                     |
| LA      | tourist_evisa    | LA_TOURIST_E_VISA (11)  | passport_scan + applicant_photo                                 | none                                               | ✓             | covered     | —                     |
| LK      | eta              | LK_ETA (13)             | passport_scan + applicant_photo                                 | visa_variant changes follow-up address fields      | ✓             | covered     | —                     |
| ZA      | tourist_evisa    | ZA_TOURIST_E_VISA (13)  | passport_scan + applicant_photo                                 | none                                               | ✓             | covered     | —                     |
| IN      | tourist_evisa    | IN_TOURIST_E_VISA (13)  | passport_scan + applicant_photo                                 | visa_purpose=medical → hospital_name; =conference → conference_name | ✓ | covered  | —                     |
| US      | b1b2 (DS-160)    | DS-160 derived          | passport_scan + applicant_photo + previous-visa scans           | full DS-160 branching (separate /simplified-form)  | ✓             | covered (sep flow) | —              |
| FR      | schengen         | France-Visas derived    | passport_scan + applicant_photo + insurance + flight + hotel    | minor children require accompanying-parent block   | ✓             | covered     | —                     |
| AU      | 600              | AU_600                  | passport_scan + applicant_photo + funds                         | none                                               | partial       | gap         | PROD-PARITY-AU         |
| VN      | tourist_evisa    | VN_E_VISA               | passport_scan + applicant_photo                                 | nationality-based fee tier                         | ✓             | covered     | —                     |
| UK      | standard         | UK_STANDARD_VISITOR     | passport_scan + applicant_photo + sponsor letter + funds        | post-auth biometrics step diverges                 | partial       | gap         | PROD-PARITY-UK         |
| EG      | tourist_evisa    | EG_E_VISA               | passport_scan + applicant_photo                                 | none                                               | ✓             | covered     | —                     |
| IT      | schengen-vfs-cn  | VFS-CN derived          | passport_scan + applicant_photo + Italian-specific docs         | residency-pin gating                               | partial       | gap         | PROD-PARITY-IT-VFS     |
| Cohort T3 (12 countries) | various | generic prefill harness | passport_scan + applicant_photo (some need extra)              | per-country open question                          | ✗             | partial     | PROD-PARITY-T3        |
| KR / JP / SG / HK / MO / PH-9a (paper) | n/a | paper template, no /application route | physical doc kit only                              | none                                               | n/a           | n/a paper   | LAUNCH-005 covers      |

## Gaps captured as PROD sub-stories

These are filed in `prd.json` as low-priority follow-ups — not blocking MVP launch but tracked so they don't fall off:

- **PROD-PARITY-AU**: AU 600 packs need an explicit financial-evidence step + summary card on /application[id] before runner enqueue.
- **PROD-PARITY-UK**: UK answer-collection wizard cuts at sponsor letter; the post-biometrics step is currently surfaced via static help text. Push it into the AnswerForm step navigation.
- **PROD-PARITY-IT-VFS**: Italy VFS-CN requires the residency PIN entered upstream. Add a prerequisite-blocker card to /application[id] when missing.
- **PROD-PARITY-T3**: T3 cohort runners share the generic prefill harness but currently rely on per-country smoke tests rather than the answer-set UI. Decide whether each of the 12 needs a bespoke question_set row or can keep a hand-curated email collection flow.

## Manual run-through method

1. Use staging environment + impersonation cookie (`/manage/impersonate`) into a synthetic applicant per country.
2. Walk every step of `/application/<id>/answer`, blur each field, refresh between steps to confirm save-resume.
3. Upload a passport scan (use `tests/fixtures/sample-passport.jpg`), confirm OCR consistency panel renders.
4. Upload applicant photo, run `processApplicantPhoto`, verify cropped output exists.
5. Run `runFaceMatch` and confirm it inserts a `face_match_audit` row.
6. Click into the per-stage card and verify the CTA resolves correctly.

Document any new gap by adding a row to the matrix and filing a `PROD-PARITY-<country>` sub-story.

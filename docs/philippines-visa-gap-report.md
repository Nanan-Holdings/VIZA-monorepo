# Philippines Visa + eTravel Gap Report - v2

**Version:** 2.0  
**Status:** Split package model implemented  
**Updated:** 2026-06-28

## 1. Coverage Summary

`PH_TEMPORARY_VISITOR_VISA` remains the Philippines 9(a) visa package.

`PH_ETRAVEL_ARRIVAL_CARD` is a new standalone arrival-card package with dedicated schema seed, frontend entry route, queue statuses, 72-hour scheduling, cancellation support, RAG guidance, and submission-service normalization/runner scaffold.

## 2. Current eTravel Status

| Concern | Status |
| --- | --- |
| Separate package from 9(a) visa | Complete |
| Form seed and bilingual labels | Complete |
| Frontend arrival-card route | Complete |
| Queue/provider/cancel statuses | Complete |
| 72-hour scheduled window | Complete |
| Submission-service normalize test | Complete |
| Official portal runner | Scaffolded; defaults to stop-before-submit and refuses fake success |
| Final-submit selector mapping | Open |
| Official QR/reference artifact capture | Required before marking live success |

## 3. Open Items

1. Complete official eTravel selector mapping through final confirmation.
2. Validate CAPTCHA/WAF behavior with Browser API/CDP or TWOCAPTCHA if encountered.
3. Run real-data `--submit` only when the applicant details are available and the operator intends final official submission.
4. Preserve QR/reference, final page screenshot/download, and portal response summary after success.

## 4. Reviewer Checklist

- [ ] Agent backend type-check/lint pass.
- [ ] Frontend type-check/lint pass.
- [ ] Submission service type-check pass.
- [ ] PH eTravel normalize test passes.
- [ ] Frontend `/client/arrival-cards/philippines` redirects to long-form with `PH_ETRAVEL_ARRIVAL_CARD`.
- [ ] Live submit is not marked successful without official QR/reference evidence.

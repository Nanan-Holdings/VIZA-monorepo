# VIZA DS-160 CEAC Autofill PRD

**Version:** 1.1
**Status:** Draft for implementation
**Owner:** VIZA
**Last updated:** 2026-06-23

---

## 1. Product Summary

VIZA needs a production-grade automation service that takes DS-160 application data already collected in VIZA, opens the official CEAC DS-160 flow at `https://ceac.state.gov/GenNIV/Default.aspx`, fills the form page by page, navigates through the **Sign and Submit Application** page when live-assisted DS-160 submission is explicitly enabled, and captures official confirmation evidence.

The automation may electronically sign and submit the application only when the applicant has authorized live-assisted submission, the required truthful signature data is present, and the DS-160 live-assisted gate is enabled. Dry-run and diagnostic modes may still stop before final submission.

After final submission, the system must save and return the information the client and operators need to verify and retrieve the DS-160 result, primarily:
- DS-160 Application ID
- official confirmation number/reference and submitted timestamp when available
- retrieval/status guidance
- supporting recovery details already known to the applicant (for example first five letters of surname, year of birth, and the selected security answer when applicable)
- proof artifacts such as redacted screenshots or PDFs from official confirmation surfaces when available

This PRD is about the **CEAC automation flow itself**, not the broader backend schema redesign.

---

## 2. Problem Statement

The current VIZA repo already contains a rough DS-160 Playwright implementation, but it is still a prototype.

Current implementation characteristics:
- goes to the CEAC DS-160 portal
- fills only a subset of sections via selector mappings
- attempts to save a `.dat` file
- attempts to extract the DS-160 Application ID
- uses a simple queue/status model

Current gaps:
1. it does not define the end-state clearly enough: submit under the live-assisted gate and capture official proof
2. it lacks a production-grade navigation strategy for CEAC's multi-page flow
3. it lacks explicit handling for save, timeout, validation, session expiry, final CAPTCHA, and partial recovery
4. it is too shallow on observability and artifacts
5. it does not have a clear definition of what success means for DS-160 automation
6. it does not clearly separate authorized one-shot submission from dry-run or manual-required outcomes

---

## 3. Goal

Build a reliable CEAC DS-160 worker that:
- loads structured DS-160 answers from VIZA
- navigates the official CEAC DS-160 form reliably
- fills each required page/section
- saves progress frequently
- reaches the **Sign and Submit Application** page
- enters applicant-authorized passport-number signature data and solves the final CAPTCHA when live-assisted mode is enabled
- clicks **Sign and Submit Application** when all required applicant authorization, signature data, and gate checks are satisfied
- captures and stores the DS-160 Application ID, confirmation evidence, retrieval artifacts, and proof screenshots/PDFs when available
- returns a submitted-result package for the client

---

## 4. Non-Goals

This phase does **not** include:
- visa appointment scheduling
- inventing applicant answers, signature data, travel facts, or security/background answers
- submitting without explicit applicant authorization and complete required data
- treating a blocked CEAC gate as success

---

## 5. Official-Flow Facts to Anchor the Design

Based on official and CEAC-linked guidance:
- DS-160 retrieval is based on the CEAC application flow and uses the **Application ID** plus identity/recovery information such as the **first five letters of surname**, **year of birth**, and the answer to the chosen **security question**.
- CEAC supports saving application progress and downloading/uploading a **`.dat`** data file.
- The final DS-160 page requires the applicant to enter their **passport/travel document number** and complete a **CAPTCHA** as part of electronic signature and submission.

Operational implication for VIZA:
- the live-assisted automation target is **confirmed DS-160 submission with official evidence**
- when a required authorization, applicant fact, CAPTCHA service, CEAC gate, or portal condition is unavailable, the worker must stop with a clear manual-required result rather than inventing data or claiming success

---

## 6. Success Criteria

A DS-160 automation run is considered successful only if all of the following are true:
1. the worker launched a CEAC DS-160 session successfully
2. the worker filled the intended DS-160 sections using stored VIZA data
3. the worker navigated to the **Sign and Submit Application** page
4. the worker performed final electronic signature and submission only under the explicit live-assisted gate with applicant-authorized signature data
5. the worker captured the **Application ID** if visible/available
6. the worker captured official post-submit evidence when CEAC exposes it:
   - confirmation number/reference
   - submitted timestamp
   - Print Confirmation / Print Application / Email Confirmation controls or equivalent official proof surface
7. the worker saved the application state in at least one durable recovery form:
   - CEAC-retrievable application
   - `.dat` file when available
   - screenshots / artifacts for ops diagnosis
8. the worker returned a submitted-result package that ops can provide to the client

---

## 7. Functional Requirements

### 7.1 CEAC session initialization
The worker must:
- open the CEAC DS-160 start page
- select the intended embassy/consulate location when required
- initiate a new DS-160 application or continue the appropriate flow
- create a traceable session/run context in VIZA

### 7.2 Page-by-page autofill
The worker must:
- fill DS-160 pages in order
- support both text and select inputs
- support yes/no gates, conditional branches, and repeating sections
- support required field validation before navigation attempts
- preserve exact field formatting required by CEAC where possible

### 7.3 Navigation and validation
The worker must:
- navigate using page-appropriate buttons/selectors
- detect whether the next page loaded successfully
- detect when CEAC remains on the same page due to validation errors
- extract inline/server-side validation messages where possible
- avoid silent progression failures

### 7.4 Save and recovery
The worker must:
- save frequently during the form progression
- prefer saving at natural section boundaries
- support `Save` / `Save to File` behaviors where available
- capture the `.dat` file when CEAC offers it
- record where and when the last successful save occurred
- recover via Application ID or saved `.dat` when possible

### 7.5 Final-page submission rule
The worker must:
- continue filling until the page containing the final e-signature and submit controls is reached
- verify that live-assisted DS-160 submission is enabled and applicant authorization is recorded
- enter the applicant-authorized passport number/signature data only from stored application answers or applicant profile data
- solve or enter the final CAPTCHA through the configured CAPTCHA provider when needed
- click **Sign and Submit Application** only after all gate checks pass
- persist a manual-required outcome if any irreversible-action prerequisite is missing

### 7.6 Submitted-result output
The worker must produce a submitted-result package containing:
- DS-160 Application ID
- official confirmation number/reference when available
- submitted timestamp when available
- latest save status
- `.dat` storage path if captured
- retrieval guidance
- any known recovery facts needed by the applicant
- proof artifact paths and redacted screenshots/PDFs when available

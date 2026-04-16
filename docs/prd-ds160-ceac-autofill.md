# VIZA DS-160 CEAC Autofill PRD

**Version:** 1.0  
**Status:** Draft for implementation  
**Owner:** VIZA  
**Last updated:** 2026-04-16

---

## 1. Product Summary

VIZA needs a production-grade automation service that takes DS-160 application data already collected in VIZA, opens the official CEAC DS-160 flow at `https://ceac.state.gov/GenNIV/Default.aspx`, fills the form page by page, navigates all the way to the **Sign and Submit Application** page, and then stops.

The automation must **not** electronically sign or submit the application.

After reaching the Sign and Submit page, the system must save and return the information the client needs to retrieve the DS-160 and complete the final submission themselves, primarily:
- DS-160 Application ID
- retrieval guidance
- supporting recovery details already known to the applicant (e.g. first five letters of surname, year of birth, security answer such as mother¡¯s first name when applicable)

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
1. it does not define the end-state clearly enough: reach the final Sign and Submit page, then stop
2. it lacks a production-grade navigation strategy for CEAC¡¯s multi-page flow
3. it lacks explicit handling for save, timeout, validation, session expiry, and partial recovery
4. it is too shallow on observability and artifacts
5. it does not have a clear definition of what success means for DS-160 automation
6. it does not clearly separate what the bot does vs what the user must do

---

## 3. Goal

Build a reliable CEAC DS-160 autofill worker that:
- loads structured DS-160 answers from VIZA
- navigates the official CEAC DS-160 form reliably
- fills each required page/section
- saves progress frequently
- reaches the **Sign and Submit Application** page
- stops before passport-number signature, CAPTCHA, and final submit
- captures and stores the DS-160 Application ID and other retrieval artifacts
- returns a handoff package for the client

---

## 4. Non-Goals

This phase does **not** include:
- entering the client¡¯s passport number as the electronic signature
- solving or submitting the final CAPTCHA on the sign page
- clicking the final **Sign and Submit Application** button
- visa appointment scheduling
- post-submission confirmation page handling as the core flow

---

## 5. Official-Flow Facts to Anchor the Design

Based on official and CEAC-linked guidance:
- DS-160 retrieval is based on the CEAC application flow and uses the **Application ID** plus identity/recovery information such as the **first five letters of surname**, **year of birth**, and the answer to the chosen **security question**.
- CEAC supports saving application progress and downloading/uploading a **`.dat`** data file.
- The final DS-160 page requires the applicant to enter their **passport/travel document number** and complete a **CAPTCHA** as part of electronic signature and submission.

Operational implication for VIZA:
- the automation target is **not submission success**
- the automation target is **arrival at the final sign/submit page with a valid retrievable application**

---

## 6. Success Criteria

A DS-160 automation run is considered successful only if all of the following are true:
1. the worker launched a CEAC DS-160 session successfully
2. the worker filled the intended DS-160 sections using stored VIZA data
3. the worker navigated to the **Sign and Submit Application** page
4. the worker did **not** perform final electronic signature or final submission
5. the worker captured the **Application ID** if visible/available
6. the worker saved the application state in at least one durable recovery form:
   - CEAC-retrievable application
   - `.dat` file when available
   - screenshots / artifacts for ops diagnosis
7. the worker returned a handoff package that ops can provide to the client

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

### 7.5 Final-page stopping rule
The worker must:
- continue filling until the page containing the final e-signature and submit controls is reached
- stop before entering the passport number as signature
- stop before solving or entering the final CAPTCHA
- stop before clicking **Sign and Submit Application**

### 7.6 Handoff output
The worker must produce a handoff package containing:
- DS-160 Application ID
- latest save status
- `.dat` storage path if captured
- retrieval guidance
- any known recovery facts needed by the applicant
- timestamp of successful stop-at-sign-page state

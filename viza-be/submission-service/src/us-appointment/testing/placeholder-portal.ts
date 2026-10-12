import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { buildUSVisaSchedulingUsername } from "../usvisascheduling-portal";
import {
  PLACEHOLDER_APPLICANT_DETAILS,
  PLACEHOLDER_CONFIRMATION_REFERENCE,
  PLACEHOLDER_CREDENTIALS,
  PLACEHOLDER_DS160_REFERENCE,
  PLACEHOLDER_SLOT,
  PLACEHOLDER_VERIFICATION_CODE,
} from "./placeholder-data";

/** A local-only portal fixture. It has no production credentials or network clients. */
export interface PlaceholderPortalSnapshot {
  events: string[];
  counts: Record<string, number>;
  accountCreated: boolean;
  emailVerified: boolean;
  authenticated: boolean;
  termsAccepted: boolean;
  profileUpdated: boolean;
  applicantDetailsValidated: boolean;
  optionsSelected: boolean;
  deliverySelected: boolean;
  paid: boolean;
  finalApproval: boolean;
  booked: boolean;
  selectedSlot: { date: string; time: string } | null;
  confirmationReference: string | null;
}

export interface PlaceholderPortal {
  origin: string;
  close(): Promise<void>;
  snapshot(): PlaceholderPortalSnapshot;
}

interface FixtureState {
  events: string[];
  counts: Record<string, number>;
  accountCreated: boolean;
  emailVerified: boolean;
  authenticated: boolean;
  termsAccepted: boolean;
  profileUpdated: boolean;
  applicantDetailsValidated: boolean;
  optionsSelected: boolean;
  deliverySelected: boolean;
  paid: boolean;
  finalApproval: boolean;
  booked: boolean;
  selectedSlot: { date: string; time: string } | null;
  confirmationReference: string | null;
  registrationAccepted: boolean;
}

const MAX_BODY_BYTES = 64 * 1024;
const SIMULATION_BANNER =
  "SIMULATION ONLY — local placeholder portal; no official request or payment";
const EXPECTED_USERNAME = buildUSVisaSchedulingUsername(PLACEHOLDER_CREDENTIALS.email);
const PLACEHOLDER_GIVEN_NAME = PLACEHOLDER_CREDENTIALS.givenName ?? "";
const PLACEHOLDER_SURNAME = PLACEHOLDER_CREDENTIALS.surname ?? "";
const SLOT_DATE = PLACEHOLDER_SLOT.appointment_date;
const SLOT_TIME = PLACEHOLDER_SLOT.appointment_time.slice(0, 5);

function initialState(): FixtureState {
  return {
    events: [],
    counts: {
      home: 0,
      send: 0,
      verify: 0,
      create: 0,
      login: 0,
      terms: 0,
      profile: 0,
      profileUpdate: 0,
      applicant: 0,
      options: 0,
      delivery: 0,
      payment: 0,
      proxyDenied: 0,
      approveFinal: 0,
      book: 0,
      confirmation: 0,
    },
    accountCreated: false,
    emailVerified: false,
    authenticated: false,
    termsAccepted: false,
    profileUpdated: false,
    applicantDetailsValidated: false,
    optionsSelected: false,
    deliverySelected: false,
    paid: false,
    finalApproval: false,
    booked: false,
    selectedSlot: null,
    confirmationReference: null,
    registrationAccepted: false,
  };
}

function record(state: FixtureState, event: string): void {
  state.counts[event] = (state.counts[event] ?? 0) + 1;
  state.events.push(event);
  if (state.events.length > 256) state.events.shift();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function asUSDate(value: string): string {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u.exec(value);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : value;
}

function page(title: string, content: string, script = ""): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>body{font-family:sans-serif;max-width:70rem;margin:2rem auto;padding:0 1rem}
      #simulation-banner{display:block;background:#fff3cd;border:2px solid #9a6700;padding:.75rem;font-weight:700}
      label{display:block;margin:.5rem 0}input,select,button{margin:.15rem;padding:.35rem}
      .error{color:#b42318}.success{color:#067647}</style></head><body>
    <aside id="simulation-banner">${SIMULATION_BANNER}</aside>${content}${script}
  </body></html>`;
}

function sendHtml(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
  });
  response.end(body);
}

function sendJson(response: ServerResponse, status: number, value: object): void {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(303, { "Cache-Control": "no-store", Location: location });
  response.end();
}

function fixedError(response: ServerResponse, status = 400): void {
  sendHtml(response, status, page("Simulation error", "<p class=\"error\">Simulation validation failed.</p>"));
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) {
        request.resume();
        return null;
      }
      chunks.push(buffer);
    }
  } catch {
    return null;
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function field(form: URLSearchParams, name: string): string {
  return form.get(name)?.trim() ?? "";
}

function isAuthenticated(state: FixtureState): boolean {
  return state.authenticated && state.accountCreated && state.termsAccepted;
}

function loginPage(error = ""): string {
  const message = error ? `<div id="login-error" class="error">${error}</div>` : "";
  return page("Sign in", `<h1>Sign in</h1>${message}
    <form action="/en-US/" method="post" id="login-form">
      <label>Username <input id="signInName" name="signInName" autocomplete="username"></label>
      <label>Password <input id="password" name="password" type="password" autocomplete="current-password"></label>
      <input type="submit" value="Sign In">
    </form>
    <a id="signup-link" href="/en-US/signup/">Sign up now</a>`);
}

function statusMarkup(state: FixtureState): string {
  if (!state.booked || !state.confirmationReference) return "";
  return `<section id="appointment-status" data-appointment-status="Scheduled">
    <h2>Appointment scheduled</h2>
    <p data-confirmation-number="${escapeHtml(state.confirmationReference)}">
      Confirmation ${escapeHtml(state.confirmationReference)}</p></section>`;
}

function homePage(state: FixtureState): string {
  if (!isAuthenticated(state)) return loginPage();
  const stage = state.applicantDetailsValidated
    ? `<a id="schedule-appointment" href="/en-US/fixture-visa-options/">Schedule Appointment</a>`
    : "";
  return page("USVisaScheduling home", `<h1>USVisaScheduling home</h1>
    <p id="authenticated-state">Authenticated simulation account.</p>
    ${statusMarkup(state)}
    <a id="start_application" href="/en-US/applicant_details/">Start Application</a>
    ${stage}`);
}

function signupPage(): string {
  return page("Create account", `<h1>Create account</h1>
    <form id="registration-form">
      <label>Username <input id="signInName" name="signInName"></label>
      <label>Password <input id="newPassword" name="newPassword" type="password"></label>
      <label>Confirm password <input id="reenterPassword" name="reenterPassword" type="password"></label>
      <label>Email <input id="email" name="email" type="email"></label>
      <label>Given name <input id="givenName" name="givenName"></label>
      <label>Surname <input id="surname" name="surname"></label>
      <label>Question 1 <select id="extension_kbq1" name="extension_kbq1"><option value="">Select</option><option value="q1">Question 1</option></select></label>
      <label>Answer 1 <input id="extension_kba1" name="extension_kba1"></label>
      <label>Question 2 <select id="extension_kbq2" name="extension_kbq2"><option value="">Select</option><option value="q2">Question 2</option></select></label>
      <label>Answer 2 <input id="extension_kba2" name="extension_kba2"></label>
      <label>Question 3 <select id="extension_kbq3" name="extension_kbq3"><option value="">Select</option><option value="q3">Question 3</option></select></label>
      <label>Answer 3 <input id="extension_kba3" name="extension_kba3"></label>
      <button id="email_ver_but_send" type="button">Send Verification Code</button>
      <section id="verification" hidden>
        <label>Verification code <input id="email_ver_input" name="emailCode"></label>
        <button id="email_ver_but_verify" type="button">Verify Code</button>
        <button id="email_ver_but_edit" type="button" hidden>Change email</button>
        <div id="email_success" role="status" hidden>Email verified.</div>
      </section>
      <div id="registration-error" class="error" role="alert" hidden></div>
      <button id="continue" type="button" hidden>Create Account</button>
    </form>`, `<script>
      const form = document.querySelector('#registration-form');
      const verification = document.querySelector('#verification');
      const error = document.querySelector('#registration-error');
      const showError = () => { error.textContent = 'Simulation validation failed.'; error.hidden = false; };
      document.querySelector('#email_ver_but_send').addEventListener('click', async () => {
        const response = await fetch('/en-US/signup/send', { method: 'POST', body: new URLSearchParams(new FormData(form)) });
        if (!response.ok) { showError(); return; }
        error.hidden = true; verification.hidden = false;
      });
      document.querySelector('#email_ver_but_verify').addEventListener('click', async () => {
        const body = new URLSearchParams({ emailCode: document.querySelector('#email_ver_input').value });
        const response = await fetch('/en-US/signup/verify', { method: 'POST', body });
        if (!response.ok) { showError(); return; }
        error.hidden = true; document.querySelector('#email_ver_input').hidden = true;
        document.querySelector('#email_ver_but_verify').hidden = true;
        document.querySelector('#email_ver_but_edit').hidden = false;
        document.querySelector('#email_success').hidden = false;
        document.querySelector('#continue').hidden = false;
      });
      document.querySelector('#continue').addEventListener('click', async () => {
        const response = await fetch('/en-US/signup/create', { method: 'POST' });
        if (!response.ok) { showError(); return; }
        window.location.assign('/en-US/');
      });
    </script>`);
}

function termsPage(): string {
  return page("Terms and Conditions", `<h1>Terms and Conditions</h1>
    <form action="/en-US/Account/Login/TermsAndConditions" method="post" id="terms-form">
      <label><input id="privacy-act-visual" name="privacyAct" type="checkbox" value="accepted"> Privacy Act</label>
      <label><input id="confidentiality-agreement" name="confidentialityAgreement" type="checkbox" value="accepted"> Confidentiality agreement</label>
      <input id="submit-agreement" type="submit" value="Continue" disabled>
    </form>`, `<script>
      const privacy = document.querySelector('#privacy-act-visual');
      const confidentiality = document.querySelector('#confidentiality-agreement');
      const submit = document.querySelector('#submit-agreement');
      const sync = () => { submit.disabled = !(privacy.checked && confidentiality.checked); };
      privacy.addEventListener('change', sync); confidentiality.addEventListener('change', sync); sync();
    </script>`);
}

function profilePage(state: FixtureState): string {
  return page("Profile", `<h1>Profile</h1>
    <form id="profile-form" action="/en-US/profile/" method="post">
      <a href="mailto:${escapeHtml(PLACEHOLDER_CREDENTIALS.email)}">${escapeHtml(PLACEHOLDER_CREDENTIALS.email)}</a>
      <a href="/en-US/Account/Login/LogOff" hidden style="display:none">LogOff</a>
      <button id="change-password" type="button">Change password</button>
      <label>First name <input id="firstname" name="firstname" value="${escapeHtml(PLACEHOLDER_GIVEN_NAME)}"></label>
      <label>Last name <input id="lastname" name="lastname" value="${escapeHtml(PLACEHOLDER_SURNAME)}"></label>
      <label>Contact email <input id="atlas_emailaddress1" name="atlas_emailaddress1" value="${state.profileUpdated ? escapeHtml(PLACEHOLDER_CREDENTIALS.email) : ""}"></label>
      <label>Preferred language <select id="adx_preferredlanguageid" name="adx_preferredlanguageid"><option value="en">English</option><option value="zh">Chinese</option></select></label>
      <label>Country <select id="atlas_country" name="atlas_country"><option value="CN">China</option><option value="US">United States</option></select></label>
      <input id="UpdateButton" type="button" value="Update">
      <div id="MessagePanel" role="alert" hidden></div>
    </form>`, `<script>
      document.querySelector('#UpdateButton').addEventListener('click', async () => {
        const form = document.querySelector('#profile-form');
        const response = await fetch('/en-US/profile/', { method: 'POST', body: new URLSearchParams(new FormData(form)) });
        if (!response.ok) { const panel = document.querySelector('#MessagePanel'); panel.textContent = 'Simulation validation failed.'; panel.hidden = false; return; }
        window.location.assign('/en-US/');
      });
    </script>`);
}

function applicantDetailsPage(): string {
  const input = (id: string, type = "text") => `<label>${id}<input id="${id}" name="${id}" type="${type}"></label>`;
  return page("Applicant Details", `<h1>Applicant Details</h1>
    <form id="applicant-form" action="/en-US/applicant_details/" method="post">
      ${input("atlas_first_name")}${input("atlas_last_name")}
      <label>Birth country <select id="atlas_pob_country" name="atlas_pob_country"><option value="">Select</option><option value="CN">China</option><option value="US">United States</option></select></label>
      <label>Home calling code <select id="atlas_home_phone_country_code" name="atlas_home_phone_country_code"><option value="">Select</option><option value="+86">+86 China</option><option value="+1">+1 United States</option></select></label>
      ${input("atlas_home_phone")}
      <label>Mobile calling code <select id="atlas_mobile_phone_country_code" name="atlas_mobile_phone_country_code"><option value="">Select</option><option value="+86">+86 China</option><option value="+1">+1 United States</option></select></label>
      ${input("atlas_mobile_phone")}${input("atlas_email")}${input("atlas_mailing_street")}
      ${input("atlas_mailing_city")}${input("atlas_mailing_state")}${input("atlas_mailing_postal_code")}
      ${input("atlas_passport_number")}${input("atlas_passport_issuance_date_datepicker_description")}
      ${input("atlas_passport_place_of_issue")}${input("atlas_passport_expiration_date_datepicker_description")}
      ${input("atlas_birthdate_datepicker_description")}
      <label>Nationality <select id="atlas_nationality" name="atlas_nationality"><option value="">Select</option><option value="CN">China</option><option value="US">United States</option></select></label>
      ${input("atlas_national_id")}
      <input id="frm_pref" name="frm_pref" type="hidden" value="">
      <input type="button" value="Submit">
      <div id="applicant-error" class="error" role="alert" hidden>Simulation validation failed.</div>
    </form>`, `<script>
      document.querySelector("input[type='button'][value='Submit']").addEventListener('click', () => document.querySelector('#applicant-form').requestSubmit());
    </script>`);
}

function optionsPage(): string {
  return page("Visa options", `<h1>Visa options</h1>
    <form action="/en-US/fixture-visa-options/" method="post">
      <label>Post <select id="fixture-post" name="postCity"><option value="Beijing">Beijing</option></select></label>
      <label>Visa class <select id="fixture-visa-class" name="visaType"><option value="B1/B2">B1/B2</option></select></label>
      <input type="hidden" name="visaCategory" value="B1B2">
      <label>DS-160 reference <input id="fixture-ds160" name="ds160Reference" value="${escapeHtml(PLACEHOLDER_DS160_REFERENCE)}"></label>
      <button id="fixture-visa-next" type="submit">Continue</button>
    </form>`);
}

function deliveryPage(): string {
  return page("Delivery", `<h1>Delivery method</h1>
    <form action="/en-US/fixture-delivery/" method="post">
      <label>Route <select id="fixture-delivery-method" name="deliveryRoute"><option value="courier">Courier</option></select></label>
      <button id="fixture-delivery-next" type="submit">Continue</button>
    </form>`);
}

function paymentPage(): string {
  return page("Payment", `<h1>Payment authorization</h1>
    <p id="payment-state" data-payment-state="unpaid">Authorize the VIZA virtual card allocation.</p>
    <form action="/en-US/fixture-payment/" method="post">
      <button id="fixture-pay" name="authorizePayment" value="authorize" type="submit">Authorize VIZA virtual card</button>
    </form>`);
}

function calendarPage(state: FixtureState): string {
  return page("Appointment calendar", `<h1>Appointment calendar</h1>
    <form action="/en-US/fixture-calendar/" method="post" id="calendar-form">
      <button class="slot" type="button" data-date="${escapeHtml(SLOT_DATE)}" data-time="${escapeHtml(SLOT_TIME)}" data-slot-id="simulated-slot">${escapeHtml(SLOT_DATE)} ${escapeHtml(SLOT_TIME)} Beijing</button>
      <input id="selected-slot-date" name="appointmentDate" type="hidden" value="">
      <input id="selected-slot-time" name="appointmentTime" type="hidden" value="">
      <button id="confirm-appointment" type="submit">Confirm Appointment</button>
    </form>`, `<script>
      const slot = document.querySelector('.slot');
      slot.addEventListener('click', () => {
        document.querySelector('#selected-slot-date').value = slot.dataset.date;
        document.querySelector('#selected-slot-time').value = slot.dataset.time;
        slot.dataset.selected = 'true'; slot.setAttribute('aria-pressed', 'true');
      });
    </script>`);
}

function confirmationPage(state: FixtureState): string {
  const reference = state.confirmationReference ?? PLACEHOLDER_CONFIRMATION_REFERENCE;
  return page("Appointment confirmation", `<h1>Appointment confirmed</h1>
    <p data-confirmation-number="${escapeHtml(reference)}">Confirmation ${escapeHtml(reference)}</p>
    <a href="/en-US/">Return home</a>`);
}

function validRegistration(form: URLSearchParams): boolean {
  const required = ["extension_kbq1", "extension_kbq2", "extension_kbq3", "extension_kba1", "extension_kba2", "extension_kba3"];
  return field(form, "signInName") === EXPECTED_USERNAME
    && field(form, "newPassword") === PLACEHOLDER_CREDENTIALS.password
    && field(form, "reenterPassword") === PLACEHOLDER_CREDENTIALS.password
    && field(form, "email") === PLACEHOLDER_CREDENTIALS.email
    && field(form, "givenName") === PLACEHOLDER_GIVEN_NAME
    && field(form, "surname") === PLACEHOLDER_SURNAME
    && required.every((name) => field(form, name).length > 0);
}

function validApplicant(form: URLSearchParams): boolean {
  const applicant = PLACEHOLDER_APPLICANT_DETAILS;
  const expected: Record<string, string> = {
    atlas_first_name: applicant.firstName,
    atlas_last_name: applicant.lastName,
    atlas_pob_country: "CN",
    atlas_home_phone_country_code: applicant.homePhone.callingCode,
    atlas_home_phone: applicant.homePhone.nationalNumber,
    atlas_mobile_phone_country_code: applicant.mobilePhone.callingCode,
    atlas_mobile_phone: applicant.mobilePhone.nationalNumber,
    atlas_email: applicant.email,
    atlas_mailing_street: applicant.mailingStreet,
    atlas_mailing_city: applicant.mailingCity,
    atlas_mailing_state: applicant.mailingState,
    atlas_mailing_postal_code: applicant.mailingPostalCode,
    atlas_passport_number: applicant.passportNumber,
    atlas_passport_issuance_date_datepicker_description: asUSDate(applicant.passportIssueDate),
    atlas_passport_place_of_issue: applicant.passportPlaceOfIssue,
    atlas_passport_expiration_date_datepicker_description: asUSDate(applicant.passportExpiryDate),
    atlas_birthdate_datepicker_description: asUSDate(applicant.dateOfBirth),
    atlas_nationality: "CN",
    atlas_national_id: applicant.nationalId,
  };
  return field(form, "frm_pref") === ""
    && Object.entries(expected).every(([name, value]) => field(form, name) === value);
}

function validProfile(form: URLSearchParams): boolean {
  return field(form, "firstname") === PLACEHOLDER_GIVEN_NAME
    && field(form, "lastname") === PLACEHOLDER_SURNAME
    && field(form, "atlas_emailaddress1") === PLACEHOLDER_CREDENTIALS.email
    && field(form, "adx_preferredlanguageid") === "en"
    && field(form, "atlas_country") === "CN";
}

async function handle(request: IncomingMessage, response: ServerResponse, state: FixtureState): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(request.url ?? "/", "http://127.0.0.1");
  } catch {
    fixedError(response, 400);
    return;
  }
  const path = parsed.pathname.replace(/\/+$/u, "") || "/";
  const method = request.method ?? "GET";

  if (method === "GET" && path === "/en-US") {
    record(state, "home");
    if (isAuthenticated(state) && !state.profileUpdated) {
      redirect(response, "/en-US/profile/");
      return;
    }
    if (isAuthenticated(state) && !state.booked) {
      if (state.paid) {
        redirect(response, "/en-US/fixture-calendar/");
        return;
      }
      if (state.deliverySelected) {
        redirect(response, "/en-US/fixture-payment/");
        return;
      }
      if (state.optionsSelected) {
        redirect(response, "/en-US/fixture-delivery/");
        return;
      }
      if (state.applicantDetailsValidated) {
        redirect(response, "/en-US/fixture-visa-options/");
        return;
      }
    }
    sendHtml(response, 200, homePage(state));
    return;
  }
  if (method === "GET" && (path === "/en-US/signup" || path === "/signup")) {
    sendHtml(response, 200, signupPage());
    return;
  }
  if (method === "POST" && (path === "/en-US/signup/send" || path === "/send")) {
    record(state, "send");
    const form = await readForm(request);
    if (!form || !validRegistration(form)) {
      fixedError(response, 400);
      return;
    }
    state.registrationAccepted = true;
    sendJson(response, 200, { ok: true });
    return;
  }
  if (method === "POST" && (path === "/en-US/signup/verify" || path === "/verify")) {
    record(state, "verify");
    const form = await readForm(request);
    if (!form || !state.registrationAccepted || field(form, "emailCode") !== PLACEHOLDER_VERIFICATION_CODE) {
      fixedError(response, 400);
      return;
    }
    state.emailVerified = true;
    sendJson(response, 200, { ok: true });
    return;
  }
  if (method === "POST" && (path === "/en-US/signup/create" || path === "/create")) {
    record(state, "create");
    if (!state.registrationAccepted || !state.emailVerified) {
      fixedError(response, 400);
      return;
    }
    state.accountCreated = true;
    sendHtml(response, 200, page("Account created", "<h1>Account created successfully.</h1>"));
    return;
  }
  if (method === "GET" && (path === "/en-US/Account/Login" || path === "/en-US/Account/Login/")) {
    sendHtml(response, 200, loginPage());
    return;
  }
  if (method === "POST" && path === "/en-US") {
    record(state, "login");
    const form = await readForm(request);
    if (!form || !state.accountCreated
      || field(form, "signInName") !== EXPECTED_USERNAME
      || field(form, "password") !== PLACEHOLDER_CREDENTIALS.password) {
      state.authenticated = false;
      sendHtml(response, 401, loginPage("Username or password is invalid."));
      return;
    }
    state.authenticated = true;
    redirect(response, state.termsAccepted ? "/en-US/" : "/en-US/Account/Login/TermsAndConditions");
    return;
  }
  if (method === "GET" && path === "/en-US/Account/Login/TermsAndConditions") {
    record(state, "terms");
    if (!state.authenticated) {
      fixedError(response, 401);
      return;
    }
    sendHtml(response, 200, termsPage());
    return;
  }
  if (method === "POST" && path === "/en-US/Account/Login/TermsAndConditions") {
    record(state, "terms");
    const form = await readForm(request);
    if (!form || !state.authenticated
      || field(form, "privacyAct") !== "accepted"
      || field(form, "confidentialityAgreement") !== "accepted") {
      fixedError(response, 400);
      return;
    }
    state.termsAccepted = true;
    redirect(response, "/en-US/profile/");
    return;
  }
  if (path === "/en-US/profile") {
    if (method === "GET") {
      record(state, "profile");
      if (!isAuthenticated(state)) {
        fixedError(response, 401);
        return;
      }
      sendHtml(response, 200, profilePage(state));
      return;
    }
    if (method === "POST") {
      record(state, "profileUpdate");
      const form = await readForm(request);
      if (!form || !isAuthenticated(state) || !validProfile(form)) {
        fixedError(response, 400);
        return;
      }
      state.profileUpdated = true;
      sendJson(response, 200, { ok: true });
      return;
    }
  }
  if (path === "/en-US/applicant_details") {
    if (method === "GET") {
      record(state, "applicant");
      if (!isAuthenticated(state) || !state.profileUpdated) {
        fixedError(response, 401);
        return;
      }
      sendHtml(response, 200, applicantDetailsPage());
      return;
    }
    if (method === "POST") {
      record(state, "applicant");
      const form = await readForm(request);
      if (!form || !isAuthenticated(state) || !state.profileUpdated || !validApplicant(form)) {
        fixedError(response, 400);
        return;
      }
      state.applicantDetailsValidated = true;
      redirect(response, "/en-US/fixture-visa-options/");
      return;
    }
  }
  if (method === "GET" && ["/en-US/fixture-visa-options", "/en-US/visa-options"].includes(path)) {
    record(state, "options");
    if (!isAuthenticated(state) || !state.applicantDetailsValidated) {
      fixedError(response, 401);
      return;
    }
    sendHtml(response, 200, optionsPage());
    return;
  }
  if (method === "POST" && ["/en-US/fixture-visa-options", "/en-US/visa-options"].includes(path)) {
    record(state, "options");
    const form = await readForm(request);
    if (!form || !isAuthenticated(state) || !state.applicantDetailsValidated
      || field(form, "postCity") !== "Beijing"
      || field(form, "visaCategory") !== "B1B2"
      || field(form, "visaType") !== "B1/B2"
      || field(form, "ds160Reference") !== PLACEHOLDER_DS160_REFERENCE) {
      fixedError(response, 400);
      return;
    }
    state.optionsSelected = true;
    redirect(response, "/en-US/fixture-delivery/");
    return;
  }
  if (method === "GET" && ["/en-US/fixture-delivery", "/en-US/delivery"].includes(path)) {
    record(state, "delivery");
    if (!isAuthenticated(state) || !state.optionsSelected) {
      fixedError(response, 401);
      return;
    }
    sendHtml(response, 200, deliveryPage());
    return;
  }
  if (method === "POST" && ["/en-US/fixture-delivery", "/en-US/delivery"].includes(path)) {
    record(state, "delivery");
    const form = await readForm(request);
    if (!form || !isAuthenticated(state) || !state.optionsSelected || field(form, "deliveryRoute").toLowerCase() !== "courier") {
      fixedError(response, 400);
      return;
    }
    state.deliverySelected = true;
    redirect(response, "/en-US/fixture-payment/");
    return;
  }
  if (method === "GET" && ["/en-US/fixture-payment", "/en-US/payment"].includes(path)) {
    record(state, "payment");
    if (!isAuthenticated(state) || !state.deliverySelected) {
      fixedError(response, 401);
      return;
    }
    sendHtml(response, 200, paymentPage());
    return;
  }
  if (method === "POST" && ["/en-US/fixture-payment", "/en-US/payment"].includes(path)) {
    record(state, "payment");
    const form = await readForm(request);
    if (!form || !isAuthenticated(state) || !state.deliverySelected || field(form, "authorizePayment") !== "authorize") {
      fixedError(response, 400);
      return;
    }
    state.paid = true;
    redirect(response, "/en-US/fixture-calendar/");
    return;
  }
  if (method === "POST" && path === "/fixture/approve-final") {
    record(state, "approveFinal");
    state.finalApproval = true;
    sendJson(response, 200, { ok: true });
    return;
  }
  if (method === "GET" && ["/en-US/fixture-calendar", "/en-US/calendar"].includes(path)) {
    if (!isAuthenticated(state) || !state.paid || state.booked) {
      fixedError(response, 409);
      return;
    }
    sendHtml(response, 200, calendarPage(state));
    return;
  }
  if (method === "POST" && ["/en-US/fixture-calendar", "/en-US/calendar"].includes(path)) {
    record(state, "book");
    const form = await readForm(request);
    const selectedDate = form ? field(form, "appointmentDate") : "";
    const selectedTime = form ? field(form, "appointmentTime") : "";
    if (!form || !isAuthenticated(state) || state.booked || !state.paid || !state.finalApproval
      || selectedDate !== SLOT_DATE || selectedTime !== SLOT_TIME) {
      fixedError(response, 409);
      return;
    }
    state.selectedSlot = { date: selectedDate, time: selectedTime };
    state.booked = true;
    state.confirmationReference = PLACEHOLDER_CONFIRMATION_REFERENCE;
    redirect(response, "/en-US/fixture-confirmation/");
    return;
  }
  if (method === "GET" && path === "/en-US/fixture-confirmation") {
    record(state, "confirmation");
    if (!isAuthenticated(state) || !state.booked) {
      fixedError(response, 409);
      return;
    }
    sendHtml(response, 200, confirmationPage(state));
    return;
  }
  fixedError(response, 404);
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Placeholder portal did not receive a TCP address."));
        return;
      }
      resolve(address.port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, "127.0.0.1");
  });
}

export async function startPlaceholderPortal(): Promise<PlaceholderPortal> {
  const state = initialState();
  let expectedHost = "";
  const server = createServer((request, response) => {
    // This endpoint is a fixture, never a forward proxy. Deny absolute-form
    // HTTP requests as well as the HTTPS tunnels rejected below.
    if (request.headers.host !== expectedHost || !request.url?.startsWith("/") || request.url.startsWith("//")) {
      state.counts.proxyDenied = (state.counts.proxyDenied ?? 0) + 1;
      state.events.push("transportDenied");
      if (state.events.length > 256) state.events.shift();
      request.resume();
      fixedError(response, 502);
      return;
    }
    void handle(request, response, state).catch(() => {
      if (!response.headersSent) fixedError(response, 500);
      else response.end();
    });
  });
  server.on("connect", (_request, socket) => {
    state.counts.proxyDenied = (state.counts.proxyDenied ?? 0) + 1;
    state.events.push("transportDenied");
    if (state.events.length > 256) state.events.shift();
    socket.write("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    socket.destroy();
  });
  const port = await listen(server);
  expectedHost = `127.0.0.1:${port}`;
  let closed = false;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: async () => {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
    snapshot: () => ({
      events: [...state.events],
      counts: { ...state.counts },
      accountCreated: state.accountCreated,
      emailVerified: state.emailVerified,
      authenticated: state.authenticated,
      termsAccepted: state.termsAccepted,
      profileUpdated: state.profileUpdated,
      applicantDetailsValidated: state.applicantDetailsValidated,
      optionsSelected: state.optionsSelected,
      deliverySelected: state.deliverySelected,
      paid: state.paid,
      finalApproval: state.finalApproval,
      booked: state.booked,
      selectedSlot: state.selectedSlot ? { ...state.selectedSlot } : null,
      confirmationReference: state.confirmationReference,
    }),
  };
}

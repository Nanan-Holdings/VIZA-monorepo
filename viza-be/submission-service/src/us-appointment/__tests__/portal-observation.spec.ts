import assert from "node:assert/strict";
import { test } from "node:test";
import { extractUSAppointmentConfirmationNumber } from "../portal-observation";
import { shouldInstallUSVisaSchedulingTurnstileHook } from "../usvisascheduling-portal";

test("confirmation extraction requires an explicit confirmation label", () => {
  assert.equal(
    extractUSAppointmentConfirmationNumber("Confirmation Number: US12345678"),
    "US12345678",
  );
  assert.equal(
    extractUSAppointmentConfirmationNumber("Appointment details — Passport: P1234567"),
    null,
  );
  assert.equal(
    extractUSAppointmentConfirmationNumber("Passport P1234567"),
    null,
  );
});

test("a data attribute remains an explicit confirmation reference", () => {
  assert.equal(
    extractUSAppointmentConfirmationNumber("Appointment details", "US12345678"),
    "US12345678",
  );
});

test("Browserbase leaves Turnstile lifecycle to the provider", () => {
  assert.equal(
    shouldInstallUSVisaSchedulingTurnstileHook("https://browserbase.example/cdp", true),
    false,
  );
  assert.equal(
    shouldInstallUSVisaSchedulingTurnstileHook("https://brd.superproxy.io:9222", false),
    false,
  );
  assert.equal(
    shouldInstallUSVisaSchedulingTurnstileHook("http://127.0.0.1:9222", false),
    true,
  );
});

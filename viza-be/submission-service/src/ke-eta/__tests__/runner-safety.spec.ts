import assert from "node:assert/strict";
import test from "node:test";
import type { SubmissionPayload } from "../../country-submissions/types";
import {
  KeEtaPortalError,
  normalizeAndRunKeEtaPortalSubmission,
} from "../runner";

function payload(): SubmissionPayload {
  return {
    payloadVersion: "test",
    countryCode: "KE",
    visaType: "KE_ETA",
    applicationId: "ke-app-runner",
    dryRun: false,
    idempotencyKey: "ke-runner-key",
    personal: {
      fullName: "ZHANG SAN",
      dateOfBirth: "1990-01-02",
      gender: "Male",
      nationality: "China",
      passportNumber: "E12345678",
      passportIssueDate: "2020-01-02",
      passportExpiryDate: "2030-01-02",
      passportIssuingCountry: "China",
      phone: "+8613800000000",
      email: "appl-test@viza.it.com",
      address: "Shanghai, China",
    },
    trip: {
      arrivalDate: "2026-09-10",
      departureDate: "2026-09-20",
      purpose: "Tourism",
      accommodationName: "Nairobi Hotel",
      accommodationAddress: "1 Nairobi Street",
    },
    countrySpecific: {
      surname: "ZHANG",
      given_names: "SAN",
      date_of_birth: "1990-01-02",
      sex: "Male",
      nationality: "China",
      passport_number: "E12345678",
      passport_issue_date: "2020-01-02",
      passport_expiry_date: "2030-01-02",
      passport_issuing_country: "China",
      email_address: "appl-test@viza.it.com",
      phone_number: "+8613800000000",
      residential_address: "Shanghai, China",
      country_of_residence: "China",
      arrival_date: "2026-09-10",
      departure_date: "2026-09-20",
      entry_point: "Jomo Kenyatta International Airport",
      flight_number: "KQ861",
      purpose_of_travel: "Tourism",
      accommodation_name: "Nairobi Hotel",
      accommodation_address: "1 Nairobi Street",
      accommodation_phone: "+254700000000",
      processing_speed: "Standard",
      has_currency_over_usd_10000: "no",
      declaration_confirmed: "yes",
    },
    metadata: {
      attachments: {
        passportBioPage: "/tmp/passport.jpg",
        passportPhoto: "/tmp/photo.jpg",
      },
    },
  };
}

test("Kenya eTA preserves form prefill until the fee checkpoint, then reports payment removal", async () => {
  const events: string[] = [];
  const result = await normalizeAndRunKeEtaPortalSubmission(payload(), {
    liveEnabled: true,
    payment: {
      prepare: async () => {
        throw new Error("payment handoff must not be called");
      },
      finalize: async () => {
        throw new Error("payment finalization must not be called");
      },
    },
    adapter: {
      submit: async (context) => {
        events.push("portal-ready");
        assert.equal(context.payload.emailAddress, "appl-test@viza.it.com");
        assert.equal(context.payload.passportNumber, "E12345678");
        events.push("form-prefill");
        await context.takePaymentCard();
        throw new Error("payment checkpoint should stop the adapter");
      },
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.submitted, false);
  assert.equal(result.errorDetails?.code, "payment_removed");
  assert.match(result.portalResponseSummary, /official fee checkpoint needs attention/iu);
  assert.deepEqual(events, ["portal-ready", "form-prefill"]);
});

test("Kenya eTA cannot bypass the fee checkpoint with an externally supplied card", async () => {
  let prepared = false;
  await assert.rejects(
    normalizeAndRunKeEtaPortalSubmission(payload(), {
      liveEnabled: true,
      payment: {
        prepare: async () => {
          prepared = true;
          return {
            paymentSessionId: "attempt-1",
            pan: "4111111111111111",
            expiry: "12/30",
            cvv: "123",
            holderName: "VIZA TEST",
          };
        },
        finalize: async () => undefined,
      },
      adapter: {
        submit: async () => ({
          portalUrl: "https://etakenya.go.ke/status",
          bodyText: "Kenya eTA application submitted. Application reference: KE-ABC12345",
          officialReference: "KE-ABC12345",
          status: "submitted",
        }),
      },
    }),
    (error: unknown) => error instanceof KeEtaPortalError
      && error.code === "ke_eta_payment_evidence_missing",
  );
  assert.equal(prepared, false);
});

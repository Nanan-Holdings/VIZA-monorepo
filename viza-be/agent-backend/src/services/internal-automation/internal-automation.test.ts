import { describe, expect, it } from "vitest";
import {
  evaluateLifecycleReadiness,
  type ConsentEventLike,
  type DocumentLike,
  type PaymentRecordLike,
  type SignatureLike,
} from "./lifecycle.js";
import {
  mapExternalStatusToLifecycleStatus,
  normalizeExternalStatus,
  normalizeExternalStatusUpdate,
} from "./external-status.js";
import { buildPacketHandoffPayload } from "./packet-handoff.js";
import { evaluateRefundEligibility } from "./refunds.js";

describe("internal automation services", () => {
  it("derives ready_for_packet when intake blockers are complete", () => {
    const readiness = evaluateLifecycleReadiness({
      application: { status: "draft" },
      payments: [paidPayment()],
      consentEvents: [acceptedConsent()],
      requiredConsentTypes: ["agency_authorisation"],
      formAnswers: [{ fieldName: "passport_number", valueText: "P123", valueJson: null }],
      requiredFormFields: ["passport_number"],
      documents: [acceptedDocument()],
      documentRequirements: [{ requirementKey: "passport_copy", required: true }],
      signatures: [completedSignature()],
      requiredSignatureTypes: ["agency_authorisation"],
      packets: [],
    });

    expect(readiness.lifecycleStatus).toBe("ready_for_packet");
    expect(readiness.readyForPacket).toBe(true);
    expect(readiness.readyForExternalHandoff).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.key)).toEqual(["packet"]);
  });

  it("normalizes external status aliases and maps customer lifecycle state", () => {
    expect(normalizeExternalStatus("documents requested")).toBe("needs_attention");
    expect(mapExternalStatusToLifecycleStatus("needs_attention")).toBe(
      "awaiting_documents"
    );

    const normalized = normalizeExternalStatusUpdate({
      status: "granted",
      reference: "REF-123",
      resultStoragePath: "https://files.example/result.pdf?token=secret#frag",
      updatedAt: "2026-05-19T00:00:00.000Z",
    });

    expect(normalized?.externalStatus).toBe("approved");
    expect(normalized?.lifecycleStatus).toBe("approved");
    expect(normalized?.resultStoragePath).toBe("https://files.example/result.pdf");
  });

  it("builds packet handoff payloads without token-like fields", () => {
    const payload = buildPacketHandoffPayload({
      application: {
        id: "app-1",
        applicantId: "applicant-1",
        country: "indonesia",
        visaType: "tourist_b211a",
        status: "packet_ready",
        arrivalDate: "2026-06-01",
        departureDate: "2026-06-10",
        portOfEntry: "DPS",
        purpose: "tourism",
        accommodationName: "Hotel",
        accommodationAddress: "Bali",
        confirmationNumber: null,
        submittedAt: null,
        visaPackageId: "package-1",
        packetStatus: "ready",
        packetReadyAt: new Date("2026-05-19T00:00:00.000Z"),
        externalStatus: null,
        externalReference: null,
        resultStatus: null,
      },
      applicant: {
        id: "applicant-1",
        fullName: "Test User",
        email: "test@example.com",
        phone: "+100000000",
        wechat: null,
        languagePref: "en",
        nationality: "China",
      },
      answers: [
        { fieldName: "passport_number", valueText: "P123", valueJson: null, updatedAt: null },
        { fieldName: "client_secret", valueText: "secret", valueJson: null, updatedAt: null },
        {
          fieldName: "travel_profile",
          valueText: null,
          valueJson: {
            city: "Bali",
            providerSessionId: "sess_secret",
            nested: { handoffToken: "token_secret", nights: 9 },
          },
          updatedAt: null,
        },
      ],
      documents: [
        {
          id: "doc-1",
          documentType: "passport_copy",
          requirementKey: "passport_copy",
          storagePath: "private/app-1/passport.pdf",
          filename: "passport.pdf",
          status: "validated",
          required: true,
          reviewedAt: null,
          createdAt: null,
        },
      ],
      signatures: [
        {
          id: "sig-1",
          signatureType: "agency_authorisation",
          signerName: "Test User",
          signedDocumentPath: "private/app-1/signature.pdf",
          documentHash: "hash",
          signedAt: null,
        },
      ],
      packet: {
        id: "packet-1",
        status: "ready",
        manifest: { fileCount: 2, handoffToken: "token_secret" },
        storagePath: "private/app-1/packet.zip",
        generatedAt: null,
      },
    });

    const serialized = JSON.stringify(payload);
    expect(payload.answers.map((answer) => answer.fieldName)).toEqual([
      "passport_number",
      "travel_profile",
    ]);
    expect(serialized).not.toContain("client_secret");
    expect(serialized).not.toContain("sess_secret");
    expect(serialized).not.toContain("token_secret");
  });

  it("makes deterministic refund eligibility decisions by lifecycle state", () => {
    const eligible = evaluateRefundEligibility({
      application: { status: "awaiting_documents" },
      payment: {
        id: "payment-1",
        amountCents: 10000,
        currency: "USD",
        status: "paid",
        feeType: "agency_fee",
      },
    });

    const afterPacket = evaluateRefundEligibility({
      application: { status: "packet_ready", packetStatus: "ready" },
      payment: {
        id: "payment-1",
        amountCents: 10000,
        currency: "USD",
        status: "paid",
        feeType: "agency_fee",
      },
    });

    expect(eligible.decision).toBe("eligible");
    expect(eligible.refundableAmountCents).toBe(10000);
    expect(afterPacket.decision).toBe("manual_review");
  });
});

function paidPayment(): PaymentRecordLike {
  return {
    id: "payment-1",
    status: "paid",
    amountCents: 10000,
    feeType: "agency_fee",
    createdAt: new Date("2026-05-19T00:00:00.000Z"),
    updatedAt: new Date("2026-05-19T00:00:00.000Z"),
  };
}

function acceptedConsent(): ConsentEventLike {
  return {
    id: "consent-1",
    consentType: "agency_authorisation",
    accepted: true,
    createdAt: new Date("2026-05-19T00:00:00.000Z"),
  };
}

function acceptedDocument(): DocumentLike {
  return {
    id: "doc-1",
    documentType: "passport_copy",
    requirementKey: "passport_copy",
    storagePath: "private/app-1/passport.pdf",
    status: "validated",
    required: true,
  };
}

function completedSignature(): SignatureLike {
  return {
    id: "sig-1",
    signatureType: "agency_authorisation",
    signatureText: null,
    signedDocumentPath: "private/app-1/signature.pdf",
    signedAt: new Date("2026-05-19T00:00:00.000Z"),
  };
}

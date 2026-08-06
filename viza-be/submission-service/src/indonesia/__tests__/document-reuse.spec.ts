import assert from "node:assert/strict";
import test from "node:test";

import {
  isPlausibleIndonesiaDocument,
  missingIndonesiaRequiredDocumentPaths,
  prioritizeCurrentApplicationDocuments,
  requiresIndonesiaReturnTicket,
  selectIndonesiaSubmissionDocuments,
} from "../document-reuse.js";

interface TestDocument {
  id: string;
  documentType: string;
  path: string;
  downloadable: boolean;
}

function foldDownloadedDocuments(documents: readonly TestDocument[]): Map<string, string> {
  const selected = new Map<string, string>();
  for (const document of documents) {
    if (document.downloadable) selected.set(document.documentType, document.path);
  }
  return selected;
}

test("current Indonesia application documents override unrelated sibling documents", () => {
  const ordered = prioritizeCurrentApplicationDocuments(
    [{ id: "current-itinerary", documentType: "travel_itinerary", path: "b1-trip.pdf", downloadable: true }],
    [{ id: "korea-annex", documentType: "travel_itinerary", path: "korea-annex17.pdf", downloadable: true }],
  );

  assert.deepEqual(ordered.map((document) => document.id), ["korea-annex", "current-itinerary"]);
  assert.equal(foldDownloadedDocuments(ordered).get("travel_itinerary"), "b1-trip.pdf");
});

test("a sibling document remains a fallback when the current storage object is unavailable", () => {
  const ordered = prioritizeCurrentApplicationDocuments(
    [{ id: "current-passport", documentType: "passport_copy", path: "missing.jpg", downloadable: false }],
    [{ id: "older-passport", documentType: "passport_copy", path: "valid.jpg", downloadable: true }],
  );

  assert.equal(foldDownloadedDocuments(ordered).get("passport_copy"), "valid.jpg");
});

test("only reuses universal passport and portrait documents from sibling applications", () => {
  const selected = selectIndonesiaSubmissionDocuments(
    [],
    [
      { id: "passport", document_type: "passport_copy", file_name: "passport.jpg", storage_path: "profile/passport.jpg" },
      { id: "photo", document_type: "photo", file_name: "photo.jpg", storage_path: "profile/photo.jpg" },
      { id: "other-trip", document_type: "travel_itinerary", file_name: "trip.pdf", storage_path: "korea/trip.pdf" },
      { id: "other-bank", document_type: "bank_statement", file_name: "bank.pdf", storage_path: "france/bank.pdf" },
    ],
  );

  assert.deepEqual(selected.map((document) => document.id), ["passport", "photo"]);
});

test("does not reject Indonesia documents based on file or storage-path names", () => {
  assert.equal(
    isPlausibleIndonesiaDocument({
      document_type: "return_ticket",
      file_name: "sg-arrival-card-X0264C6369.pdf",
      storage_path: "app/return_ticket/sg-arrival-card-X0264C6369.pdf",
    }),
    true,
  );
  assert.equal(
    isPlausibleIndonesiaDocument({
      document_type: "bank_statement",
      file_name: "bank_statement.pdf",
      storage_path: "test/app/bank_statement.pdf",
    }),
    true,
  );
});

test("accepts current-application files regardless of name without reusing non-universal sibling files", () => {
  const currentArrivalCard = {
    id: "current-test-file",
    document_type: "return_ticket",
    file_name: "sg-arrival-card.pdf",
    storage_path: "current/return_ticket/sg-arrival-card.pdf",
  };
  const siblingArrivalCard = {
    id: "sibling-test-file",
    document_type: "return_ticket",
    file_name: "sg-arrival-card.pdf",
    storage_path: "sibling/return_ticket/sg-arrival-card.pdf",
  };

  assert.deepEqual(
    selectIndonesiaSubmissionDocuments(
      [currentArrivalCard],
      [siblingArrivalCard],
    ).map((document) => document.id),
    ["current-test-file"],
  );
});

test("allocates B1 and C1 document requirements before card consumption", () => {
  const common = {
    passportImagePath: "passport.jpg",
    photoImagePath: "photo.jpg",
    returnTicketPath: "ticket.pdf",
  };
  assert.deepEqual(missingIndonesiaRequiredDocumentPaths({ isB1: true, ...common }), []);
  assert.deepEqual(
    missingIndonesiaRequiredDocumentPaths({ isB1: false, ...common }),
    ["bank_statement"],
  );
  assert.deepEqual(
    missingIndonesiaRequiredDocumentPaths({ isB1: true, passportImagePath: "passport.jpg", photoImagePath: "photo.jpg" }),
    ["return_ticket"],
  );
  assert.deepEqual(
    missingIndonesiaRequiredDocumentPaths({
      isB1: false,
      passportImagePath: "passport-without-extension",
      photoImagePath: "portrait-without-extension",
      bankStatementPath: "bank-statement-without-extension",
    }),
    [],
  );
  assert.deepEqual(
    missingIndonesiaRequiredDocumentPaths({
      isB1: false,
      documentTravelType: "Passport",
      passportImagePath: "passport.jpg",
      photoImagePath: "photo.jpg",
      bankStatementPath: "bank.pdf",
    }),
    [],
  );
  assert.deepEqual(
    missingIndonesiaRequiredDocumentPaths({
      isB1: false,
      documentTravelType: "Emergency Passport",
      passportImagePath: "passport.jpg",
      photoImagePath: "photo.jpg",
      bankStatementPath: "bank.pdf",
    }),
    ["return_ticket"],
  );
});

test("limits the C1 ticket requirement to non-national travel documents", () => {
  assert.equal(requiresIndonesiaReturnTicket(false, "Passport"), false);
  assert.equal(requiresIndonesiaReturnTicket(false, "Diplomatic Passport"), false);
  assert.equal(requiresIndonesiaReturnTicket(false, "Certificate of Identity"), true);
  assert.equal(requiresIndonesiaReturnTicket(true, "Passport"), true);
});

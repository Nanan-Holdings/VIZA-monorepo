import { describe, expect, it } from "vitest";
import {
  buildUpdatedSnapshot,
  normalizeOfficialOptionPayload,
  parseGeneratorArguments,
} from "./generate-official-options-snapshot";

describe("Korea e-Arrival Card official option snapshot generator", () => {
  it("normalizes only safe code/label fields and drops response extras", () => {
    const options = normalizeOfficialOptionPayload(
      { data: [{ code: "KR", name: "Korea", applicantEmail: "secret@example.test" }] },
      "nationality",
    );
    expect(options).toEqual([{
      value: "KR",
      code: "KR",
      text: "Korea",
      label_en: "Korea",
      official_label: "Korea",
    }]);
    expect(JSON.stringify(options)).not.toContain("secret@example.test");
  });

  it("allows only an empty additional-question snapshot, not empty core lists", () => {
    expect(normalizeOfficialOptionPayload([], "additionalQuestions")).toEqual([]);
    expect(() => normalizeOfficialOptionPayload(
      { data: [{ code: "Q1", label: "New question" }] },
      "additionalQuestions",
    )).toThrow(/portal-changed.*additional questions.*not modeled/i);
    expect(() => normalizeOfficialOptionPayload([], "airports")).toThrow("unexpectedly empty");
    expect(() => normalizeOfficialOptionPayload({ data: [{ unexpected: "shape" }] }, "flightAndShip"))
      .toThrow("missing code/label");
  });

  it("updates dynamic lists without changing static option lists", () => {
    const existing = {
      reviewedAt: "2026-08-18",
      staticLists: { sex: [{ value: "F", label_en: "Female" }] },
      sourceEndpoints: {},
      dynamicLists: {},
    };
    const snapshot = buildUpdatedSnapshot(existing, {
      nationality: [{ value: "US", code: "US", text: "United States", label_en: "United States", official_label: "United States" }],
      airports: [{ value: "ICN", code: "ICN", text: "Incheon", label_en: "Incheon", official_label: "Incheon" }],
      flightAndShip: [{ value: "KE001", code: "KE001", text: "KE001", label_en: "KE001", official_label: "KE001" }],
      additionalQuestions: [],
    }, "2026-08-19");
    expect(snapshot.snapshotVersion).toBe("2026-08-19");
    expect(snapshot.reviewedAt).toBe("2026-08-19");
    expect(snapshot.staticLists).toEqual(existing.staticLists);
    expect(snapshot.sourceEndpoints).toMatchObject({ additionalQuestions: "/portal/apply/srchAddItemList.do" });
    expect((snapshot.additionalQuestions as Record<string, unknown>).items).toEqual([]);
    expect(() => buildUpdatedSnapshot(existing, {
      nationality: [],
      airports: [],
      flightAndShip: [],
      additionalQuestions: [{ value: "Q1", code: "Q1", text: "New question", label_en: "New question", official_label: "New question" }],
    }, "2026-08-19")).toThrow(/portal-changed.*additional questions/i);
  });

  it("requires explicit update for writes", () => {
    expect(parseGeneratorArguments([])).toEqual({ update: false });
    expect(parseGeneratorArguments(["--update"])).toEqual({ update: true });
    expect(() => parseGeneratorArguments(["--write"])).toThrow("Unknown snapshot generator argument");
  });
});

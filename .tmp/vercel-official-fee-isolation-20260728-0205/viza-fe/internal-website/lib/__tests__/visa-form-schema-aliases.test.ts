import { describe, expect, it } from "vitest";
import {
  resolveVisaFormSchemaVisaType,
  visaFormSchemaVisaTypesMatch,
} from "../visa-form-schema-aliases";

describe("visa form schema aliases", () => {
  it("maps Vietnam evisa_tourism route params to the VN_E_VISA schema", () => {
    expect(resolveVisaFormSchemaVisaType("evisa_tourism", "vietnam")).toBe("VN_E_VISA");
    expect(resolveVisaFormSchemaVisaType("evisa_tourism", "VN")).toBe("VN_E_VISA");
  });

  it("does not remap generic evisa_tourism for other countries", () => {
    expect(resolveVisaFormSchemaVisaType("evisa_tourism", "egypt")).toBe("evisa_tourism");
    expect(resolveVisaFormSchemaVisaType("evisa_tourism", null)).toBe("evisa_tourism");
  });

  it("matches Vietnam route aliases against stored VN_E_VISA rows only for Vietnam", () => {
    expect(visaFormSchemaVisaTypesMatch("evisa_tourism", "VN_E_VISA", "vietnam")).toBe(true);
    expect(visaFormSchemaVisaTypesMatch("evisa_tourism", "VN_E_VISA", "egypt")).toBe(false);
  });
});

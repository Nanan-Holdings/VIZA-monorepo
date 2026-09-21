import { describe, expect, it } from "vitest";

import {
  DS160_PHOTO_ACCEPT,
  DS160_PHOTO_MAX_BYTES,
  getDs160PhotoErrorMessage,
  isDs160PhotoRequirement,
  validateDs160PhotoBytes,
} from "./ds160-photo-contract";

function jpegFixture(options: {
  width?: number;
  height?: number;
  precision?: number;
  components?: number;
} = {}): Uint8Array {
  const width = options.width ?? 600;
  const height = options.height ?? 600;
  const precision = options.precision ?? 8;
  const components = options.components ?? 3;
  const payload = [
    precision,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    components,
  ];
  const componentDescriptors = Array.from({ length: components }, (_, index) => [index + 1, 0x11, 0x00]).flat();
  const sofPayload = [...payload, ...componentDescriptors];
  const sosPayload = [
    components,
    ...Array.from({ length: components }, (_, index) => [index + 1, 0x00]).flat(),
    0x00,
    0x3f,
    0x00,
  ];
  const result = [
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x02,
    0xff,
    0xc0,
    0x00,
    sofPayload.length + 2,
    ...sofPayload,
    0xff,
    0xda,
    0x00,
    sosPayload.length + 2,
    ...sosPayload,
    0x00,
    0xff,
    0x00,
    0x01,
    0xff,
    0xd9,
  ];
  return Uint8Array.from(result);
}

describe("DS-160 photo contract", () => {
  it("accepts a valid 8-bit three-channel square JPEG in the official range", () => {
    expect(validateDs160PhotoBytes(jpegFixture())).toBeNull();
    expect(validateDs160PhotoBytes(jpegFixture({ width: 1200, height: 1200 }))).toBeNull();
  });

  it("requires a JPEG signature and a readable SOF frame", () => {
    expect(validateDs160PhotoBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe("wrong_format");
    expect(validateDs160PhotoBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02]))).toBe("corrupt_image");
    const truncatedSof = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x08, 8, 0x02, 0x58, 0x02, 0x58, 3, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
    expect(validateDs160PhotoBytes(truncatedSof)).toBe("corrupt_image");
  });

  it("enforces the byte, dimension, square, and color-channel rules", () => {
    const tooLarge = new Uint8Array(DS160_PHOTO_MAX_BYTES + 1);
    tooLarge.set(jpegFixture());
    expect(validateDs160PhotoBytes(tooLarge)).toBe("file_too_large");
    expect(validateDs160PhotoBytes(jpegFixture({ width: 599, height: 599 }))).toBe("dimensions_too_small");
    expect(validateDs160PhotoBytes(jpegFixture({ width: 1201, height: 1201 }))).toBe("dimensions_too_large");
    expect(validateDs160PhotoBytes(jpegFixture({ width: 600, height: 601 }))).toBe("not_square");
    expect(validateDs160PhotoBytes(jpegFixture({ components: 1 }))).toBe("invalid_color");
    expect(validateDs160PhotoBytes(jpegFixture({ precision: 12 }))).toBe("invalid_color");
  });

  it("scopes the requirement to U.S. DS-160 aliases and known photo fields", () => {
    expect(DS160_PHOTO_ACCEPT).toContain(".jpg");
    expect(isDs160PhotoRequirement({
      country: "united_states",
      visaType: "B1_B2",
      documentType: "photo",
    })).toBe(true);
    expect(isDs160PhotoRequirement({
      country: "USA",
      visaType: "DS-160",
      documentType: "supporting_document",
      requirementKey: "portrait_photo",
    })).toBe(true);
    expect(isDs160PhotoRequirement({
      country: "united_states",
      visaType: "VN_E_VISA",
      documentType: "photo",
    })).toBe(false);
    expect(isDs160PhotoRequirement({
      country: "canada",
      visaType: "B1_B2",
      documentType: "photo",
    })).toBe(false);
  });

  it("provides localized messages for every byte-validation failure", () => {
    expect(getDs160PhotoErrorMessage("file_too_large", true)).toContain("240 KB");
    expect(getDs160PhotoErrorMessage("wrong_format", false)).toContain("JPEG");
    expect(getDs160PhotoErrorMessage("invalid_color", true)).toContain("3 通道");
  });
});

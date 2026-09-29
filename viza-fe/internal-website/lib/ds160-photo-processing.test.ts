import { describe, expect, it } from "vitest";

import {
  DS160_JPEG_INITIAL_QUALITY,
  DS160_JPEG_MIN_QUALITY,
  DS160_PHOTO_OUTPUT_SIZE,
  encodeJpegWithinLimit,
} from "./ds160-photo-processing";

function blobOfBytes(size: number): Blob {
  return new Blob([new Uint8Array(size)], { type: "image/jpeg" });
}

describe("DS-160 JPEG compression", () => {
  it("keeps the initial quality when the crop already fits", async () => {
    const result = await encodeJpegWithinLimit(
      async () => blobOfBytes(100),
      { maxBytes: 240 },
    );

    expect(result.blob.size).toBe(100);
    expect(result.quality).toBe(DS160_JPEG_INITIAL_QUALITY);
  });

  it("adaptively finds the highest quality under the byte limit", async () => {
    const result = await encodeJpegWithinLimit(
      async (quality) => blobOfBytes(Math.ceil(quality * 500)),
      { maxBytes: 300, searchIterations: 12 },
    );

    expect(result.blob.size).toBeLessThanOrEqual(300);
    expect(result.quality).toBeGreaterThan(0.59);
    expect(result.quality).toBeLessThanOrEqual(DS160_JPEG_INITIAL_QUALITY);
    expect(result.quality).toBeGreaterThan(DS160_JPEG_MIN_QUALITY);
  });

  it("fails when even the lowest quality cannot meet the limit", async () => {
    await expect(
      encodeJpegWithinLimit(
        async () => blobOfBytes(301),
        { maxBytes: 300 },
      ),
    ).rejects.toMatchObject({
      code: "jpeg_size_limit_unreachable",
    });
  });

  it("treats a missing encoder result as a real processing failure", async () => {
    await expect(
      encodeJpegWithinLimit(async () => null, { maxBytes: 300 }),
    ).rejects.toMatchObject({
      code: "jpeg_encode_failed",
    });
  });

  it("uses the official fixed output dimension", () => {
    expect(DS160_PHOTO_OUTPUT_SIZE).toBe(600);
  });
});

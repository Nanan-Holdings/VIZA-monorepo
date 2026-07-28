import { afterEach, describe, expect, it, vi } from "vitest";

import { extractPassportOcr } from "./provider";
import type { PassportOcrFile } from "./types";

const FIELD_NAMES = [
  "full_name",
  "native_full_name",
  "given_names",
  "surname",
  "passport_number",
  "date_of_birth",
  "place_of_birth",
  "nationality",
  "issuing_country",
  "issue_date",
  "expiry_date",
  "gender",
] as const;

function successResponse() {
  const fields = {
    full_name: "ANNA MARIA ERIKSSON",
    native_full_name: null,
    given_names: "ANNA MARIA",
    surname: "ERIKSSON",
    passport_number: "L898902C3",
    date_of_birth: "1974-08-12",
    place_of_birth: "UTOPIA",
    nationality: "UTO",
    issuing_country: "UTO",
    issue_date: "2007-04-15",
    expiry_date: "2012-04-15",
    gender: "F",
  };
  const fieldConfidence = Object.fromEntries(FIELD_NAMES.map((field) => [field, 0.98]));

  return Response.json({
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              is_readable: true,
              confidence: 0.98,
              fields,
              field_confidence: fieldConfidence,
            }),
          },
        ],
      },
    ],
  });
}

function unreadableResponse() {
  const fields = Object.fromEntries(FIELD_NAMES.map((field) => [field, null]));
  const fieldConfidence = Object.fromEntries(FIELD_NAMES.map((field) => [field, null]));

  return Response.json({
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              is_readable: false,
              confidence: 0.2,
              fields,
              field_confidence: fieldConfidence,
            }),
          },
        ],
      },
    ],
  });
}

function modelNotFoundResponse() {
  return Response.json(
    {
      error: {
        type: "invalid_request_error",
        code: "model_not_found",
        message: "Project does not have access to this model.",
      },
    },
    { status: 403 },
  );
}

function invalidKeyResponse() {
  return Response.json(
    {
      error: {
        type: "invalid_request_error",
        code: "invalid_api_key",
        message: "Incorrect API key provided.",
      },
    },
    { status: 401 },
  );
}

function chineseNameWithMrzResponse() {
  const fields = {
    full_name: "张三",
    native_full_name: "张三",
    given_names: "三",
    surname: "张",
    passport_number: "E12345678",
    date_of_birth: "1990-01-01",
    place_of_birth: "BEIJING",
    nationality: "CHN",
    issuing_country: "CHN",
    issue_date: "2020-01-01",
    expiry_date: "2030-01-01",
    gender: "M",
  };
  const fieldConfidence = Object.fromEntries(FIELD_NAMES.map((field) => [field, 0.98]));

  return Response.json({
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              is_readable: true,
              confidence: 0.98,
              fields,
              field_confidence: fieldConfidence,
              mrz: {
                line1: "P<CHNZHANG<<SAN<<<<<<<<<<<<<<<<<<<<<<<<",
                line2: "E123456780CHN9001011M3001012<<<<<<<<<<<<<<00",
              },
            }),
          },
        ],
      },
    ],
  });
}

function fullNameAsSurnameResponse() {
  const fields = {
    full_name: "LI XIAOMING",
    native_full_name: "李晓明",
    given_names: "XIAOMING",
    surname: "LI XIAOMING",
    passport_number: "E12345678",
    date_of_birth: "1990-01-01",
    place_of_birth: "HUNAN",
    nationality: "CHN",
    issuing_country: "CHN",
    issue_date: "2020-01-01",
    expiry_date: "2030-01-01",
    gender: "M",
  };
  const fieldConfidence = Object.fromEntries(FIELD_NAMES.map((field) => [field, 0.98]));

  return Response.json({
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              is_readable: true,
              confidence: 0.98,
              fields,
              field_confidence: fieldConfidence,
              mrz: {
                line1: null,
                line2: null,
              },
            }),
          },
        ],
      },
    ],
  });
}

function mrzNoiseNameResponse() {
  const fields = {
    full_name: "EMCHNM LI XIAOMING",
    native_full_name: "李晓明",
    given_names: "XIAOMING",
    surname: "LI",
    passport_number: "EM7429107",
    date_of_birth: "2006/07/27",
    place_of_birth: "HAINAN",
    nationality: "CHINESE",
    issuing_country: "CHN",
    issue_date: "2024/06/25",
    expiry_date: "2034/06/24",
    gender: "M",
  };
  const fieldConfidence = Object.fromEntries(FIELD_NAMES.map((field) => [field, 0.72]));

  return Response.json({
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              is_readable: true,
              confidence: 0.82,
              fields,
              field_confidence: fieldConfidence,
              mrz: {
                line1: null,
                line2: "EM74291070CHN0607270M3406245<<<<<<<<<<<<<<06",
              },
            }),
          },
        ],
      },
    ],
  });
}

function requestBodies(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  return fetchMock.mock.calls.map((call) => {
    const init = call[1];
    expect(init?.body).toEqual(expect.any(String));
    return JSON.parse(init?.body as string) as {
      model: string;
      input: Array<{ content: Array<Record<string, string>> }>;
    };
  });
}

describe("passport OCR provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("sends PDFs as data URLs accepted by the OpenAI file input", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(successResponse());
    vi.stubGlobal("fetch", fetchMock);
    const file: PassportOcrFile = {
      bytes: Buffer.from("%PDF-1.7 synthetic passport fixture"),
      filename: "passport.pdf",
      mimeType: "application/pdf",
    };

    await extractPassportOcr(file);

    const [body] = requestBodies(fetchMock);
    const filePart = body.input[1].content[1];
    expect(body.model).toBe("gpt-4o");
    expect(filePart.type).toBe("input_file");
    expect(filePart.file_data).toMatch(/^data:application\/pdf;base64,/);
  });

  it("falls back to the default accessible model when a configured model is unavailable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("PASSPORT_OCR_OPENAI_MODEL", "gpt-4.1-mini");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(modelNotFoundResponse())
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal("fetch", fetchMock);
    const file: PassportOcrFile = {
      bytes: Buffer.from("synthetic image bytes"),
      filename: "passport.jpg",
      mimeType: "image/jpeg",
    };

    const result = await extractPassportOcr(file);

    const bodies = requestBodies(fetchMock);
    expect(bodies.map((body) => body.model)).toEqual(["gpt-4.1-mini", "gpt-4o"]);
    expect(result.isReadable).toBe(true);
    expect(result.fields.passportNumber.value).toBe("L898902C3");
  });

  it("retries with rotated-document guidance before returning unreadable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(unreadableResponse())
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal("fetch", fetchMock);
    const file: PassportOcrFile = {
      bytes: Buffer.from("sideways passport image bytes"),
      filename: "passport.jpg",
      mimeType: "image/jpeg",
    };

    const result = await extractPassportOcr(file);

    const bodies = requestBodies(fetchMock);
    expect(bodies).toHaveLength(2);
    expect(JSON.stringify(bodies[1].input)).toContain("Rotate it mentally");
    expect(result.isReadable).toBe(true);
    expect(result.fields.passportNumber.value).toBe("L898902C3");
  });

  it("reports credential failures as provider unavailable instead of unreadable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(invalidKeyResponse());
    vi.stubGlobal("fetch", fetchMock);
    const file: PassportOcrFile = {
      bytes: Buffer.from("synthetic image bytes"),
      filename: "passport.jpg",
      mimeType: "image/jpeg",
    };

    await expect(extractPassportOcr(file)).rejects.toMatchObject({
      code: "provider_unavailable",
      message: "Passport OCR provider credentials or billing are not available.",
      retryable: false,
    });
  });

  it("uses the Latin MRZ name when local-script name text is also visible", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(chineseNameWithMrzResponse());
    vi.stubGlobal("fetch", fetchMock);
    const file: PassportOcrFile = {
      bytes: Buffer.from("synthetic china passport image bytes"),
      filename: "passport.jpg",
      mimeType: "image/jpeg",
    };

    const result = await extractPassportOcr(file);

    const [body] = requestBodies(fetchMock);
    expect(JSON.stringify(body.input)).toContain("Latin/MRZ spelling");
    expect(JSON.stringify(body.input)).toContain("native_full_name");
    expect(result.fields.fullName.value).toBe("ZHANG SAN");
    expect(result.fields.nativeFullName.value).toBe("张三");
    expect(result.fields.givenNames.value).toBe("SAN");
    expect(result.fields.surname.value).toBe("ZHANG");
    expect(result.warnings).toContain("name_latinized_from_mrz");
  });

  it("repairs surname when the provider duplicates the full Latin name there", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(fullNameAsSurnameResponse());
    vi.stubGlobal("fetch", fetchMock);
    const file: PassportOcrFile = {
      bytes: Buffer.from("synthetic china passport image bytes"),
      filename: "passport.jpg",
      mimeType: "image/jpeg",
    };

    const result = await extractPassportOcr(file);

    expect(result.fields.fullName.value).toBe("LI XIAOMING");
    expect(result.fields.givenNames.value).toBe("XIAOMING");
    expect(result.fields.surname.value).toBe("LI");
    expect(result.warnings).toContain("surname_repaired_from_full_name");
  });

  it("repairs MRZ-contaminated names and verifies core fields from MRZ line 2", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(mrzNoiseNameResponse());
    vi.stubGlobal("fetch", fetchMock);
    const file: PassportOcrFile = {
      bytes: Buffer.from("synthetic china passport image bytes"),
      filename: "passport.jpg",
      mimeType: "image/jpeg",
    };

    const result = await extractPassportOcr(file);

    expect(result.fields.fullName.value).toBe("LI XIAOMING");
    expect(result.fields.givenNames.value).toBe("XIAOMING");
    expect(result.fields.surname.value).toBe("LI");
    expect(result.fields.passportNumber.value).toBe("EM7429107");
    expect(result.fields.dateOfBirth.value).toBe("2006-07-27");
    expect(result.fields.expiryDate.value).toBe("2034-06-24");
    expect(result.fields.gender.value).toBe("M");
    expect(result.warnings).toContain("full_name_repaired_from_name_parts");
    expect(result.warnings).toContain("fields_verified_from_mrz");
  });
});

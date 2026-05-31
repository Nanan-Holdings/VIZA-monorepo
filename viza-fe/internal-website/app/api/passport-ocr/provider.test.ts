import { afterEach, describe, expect, it, vi } from "vitest";

import { extractPassportOcr } from "./provider";
import type { PassportOcrFile } from "./types";

const FIELD_NAMES = [
  "full_name",
  "given_names",
  "surname",
  "passport_number",
  "date_of_birth",
  "nationality",
  "issuing_country",
  "issue_date",
  "expiry_date",
  "gender",
] as const;

function successResponse() {
  const fields = {
    full_name: "ANNA MARIA ERIKSSON",
    given_names: "ANNA MARIA",
    surname: "ERIKSSON",
    passport_number: "L898902C3",
    date_of_birth: "1974-08-12",
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
    expect(body.model).toBe("gpt-4o-mini");
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
    expect(bodies.map((body) => body.model)).toEqual(["gpt-4.1-mini", "gpt-4o-mini"]);
    expect(result.isReadable).toBe(true);
    expect(result.fields.passportNumber.value).toBe("L898902C3");
  });
});

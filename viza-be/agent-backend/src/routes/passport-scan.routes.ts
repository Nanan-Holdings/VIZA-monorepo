/**
 * Passport Scan Routes
 *
 * POST /api/passport-scan/extract
 *
 * Accepts a base64-encoded passport data-page image and returns the
 * structured fields needed to prefill the simplified-form identity step.
 * The actual OCR is delegated to Claude Sonnet vision via the Anthropic SDK
 * with tool-call structured output, so the response always conforms to the
 * `PassportExtraction` schema below.
 *
 * The caller (Next.js API proxy) is expected to have already verified that
 * the user owns the source image — this route does not enforce auth itself.
 */

import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { Logger } from "../utils/logger.js";
import { maskPII } from "../utils/phi-masker.js";

const logger = new Logger({ serviceName: "PassportScanRoutes" });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // Anthropic accepts up to 5MB base64-decoded; we cap raw input at 8MB

const PASSPORT_EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_passport",
  description:
    "Return the fields visible on the passport biographic data page, formatted for a U.S. DS-160 visa intake form.",
  input_schema: {
    type: "object",
    properties: {
      surname: { type: "string", description: "Family / last name as printed on the passport, uppercase." },
      givenNames: { type: "string", description: "Given / first names as printed on the passport, uppercase." },
      dob: { type: "string", description: "Date of birth, ISO 8601 (YYYY-MM-DD). Empty string if unreadable." },
      sex: { type: "string", enum: ["Male", "Female", ""], description: "Sex; empty if unreadable." },
      nationality: {
        type: "string",
        description: "Nationality as ISO 3166-1 alpha-3 country code (e.g. CHN, USA, GBR). Empty if unreadable.",
      },
      cityOfBirth: { type: "string", description: "City of birth, if printed." },
      countryOfBirth: {
        type: "string",
        description: "Country of birth as ISO 3166-1 alpha-3 country code, if derivable.",
      },
      passportNumber: { type: "string", description: "Passport number exactly as printed." },
      passportType: {
        type: "string",
        enum: ["Regular", "Official", "Diplomatic", "Permit", "Other"],
        description: "Document type. Default 'Regular' for ordinary passports.",
      },
      issuingCountry: {
        type: "string",
        description: "Country that issued the passport, ISO 3166-1 alpha-3.",
      },
      issuanceCity: { type: "string", description: "City of issuance, if printed." },
      issuanceProvince: { type: "string", description: "State / province of issuance, if printed." },
      issueDate: { type: "string", description: "Issue date, ISO 8601 (YYYY-MM-DD)." },
      expiryDate: { type: "string", description: "Expiry date, ISO 8601 (YYYY-MM-DD)." },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description:
          "Overall confidence: high if all major fields read cleanly; medium if 1-2 fields are uncertain; low if more than 2 fields are uncertain or the image is unclear.",
      },
      warnings: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional list of issues, e.g. 'expired', 'unreadable_mrz', 'photo_too_blurry', 'not_a_passport'.",
      },
    },
    required: [
      "surname",
      "givenNames",
      "dob",
      "sex",
      "nationality",
      "passportNumber",
      "issuingCountry",
      "issueDate",
      "expiryDate",
      "confidence",
    ],
  },
};

const PASSPORT_EXTRACT_PROMPT = `You are a passport data-page OCR engine. The user has uploaded a single image that should be the photo / biographic data page of their passport.

Read every visible field — including the MRZ (machine-readable zone) at the bottom — and return the structured payload via the extract_passport tool. Rules:

- Convert nationalities and countries to ISO 3166-1 alpha-3 codes (e.g. "CHN" not "China", "USA" not "United States"). Use the MRZ codes if the printed name is in a foreign script.
- Dates are ISO 8601 (YYYY-MM-DD). If the year prefix is ambiguous (MRZ uses 2-digit years), use the modern century by checking against the issue/expiry pair.
- Names are uppercase, exactly as printed on the data page.
- Sex is "Male" or "Female". If MRZ shows X / unspecified, leave empty.
- Passport type: "Regular" for ordinary passports (default if unclear), "Official", "Diplomatic", "Permit", or "Other".
- Empty string for any field you cannot read confidently — do not guess.
- Set confidence based on how readable the major fields (name, dob, passport number, dates) were.
- Add a warning if the image does not appear to be a passport, is severely blurry, or the document is expired.`;

export const passportScanRouter = Router();

passportScanRouter.post("/extract", async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "your_anthropic_api_key_here") {
      logger.error("anthropic_key_missing", new Error("ANTHROPIC_API_KEY not configured"));
      res.status(500).json({ error: true, message: "OCR service not configured" });
      return;
    }

    const { imageBase64, mediaType } = req.body as {
      imageBase64?: string;
      mediaType?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.status(400).json({ error: true, message: "imageBase64 (string) required" });
      return;
    }

    const declaredMedia = (mediaType || "image/jpeg").toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(declaredMedia)) {
      res.status(400).json({ error: true, message: "mediaType must be jpeg, png, or webp" });
      return;
    }

    if (imageBase64.length > MAX_IMAGE_BYTES) {
      res.status(413).json({ error: true, message: "Image too large; max ~8MB base64" });
      return;
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const start = Date.now();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [PASSPORT_EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_passport" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: declaredMedia as "image/jpeg" | "image/png" | "image/webp",
                data: imageBase64,
              },
            },
            { type: "text", text: PASSPORT_EXTRACT_PROMPT },
          ],
        },
      ],
    });

    const elapsedMs = Date.now() - start;

    const toolBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolBlock || toolBlock.name !== "extract_passport") {
      logger.error("extract_no_tool_use", new Error("Claude did not return the expected tool call"), {
        elapsedMs,
        stopReason: response.stop_reason,
      });
      res
        .status(502)
        .json({ error: true, message: "Extraction returned no structured result" });
      return;
    }

    const extracted = toolBlock.input as Record<string, unknown>;

    // Mask passport number in logs — never write it in clear.
    logger.info("passport_extracted", {
      elapsedMs,
      confidence: extracted.confidence,
      warnings: extracted.warnings,
      passportNumberHash: maskPII(String(extracted.passportNumber ?? "")),
      hasName: !!extracted.surname && !!extracted.givenNames,
      hasDates: !!extracted.dob && !!extracted.expiryDate,
    });

    res.json({ error: false, extracted });
  } catch (error) {
    logger.error("passport_extract_failed", error as Error);
    res.status(500).json({
      error: true,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default passportScanRouter;

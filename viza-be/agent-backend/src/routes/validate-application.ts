/**
 * AI Validation Layer
 * POST /api/validate-application
 *
 * Validates a VIZA application against:
 *  1. Hard rules (passport expiry, date ranges, required docs)
 *  2. Claude-powered semantic check against pgvector knowledge base
 *
 * Returns: { valid: boolean, errors: FieldError[], warnings: FieldError[], blocked: boolean }
 */

import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";

const router = Router();
const logger = new Logger({ serviceName: "ValidateApplication" });

interface FieldError {
  field: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
  warnings: FieldError[];
  blocked: boolean;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Hard-coded rule checks (run before Claude)
function runHardRules(app: Record<string, unknown>, docs: string[]): {
  errors: FieldError[];
  warnings: FieldError[];
} {
  const errors: FieldError[] = [];
  const warnings: FieldError[] = [];

  const arrivalDate = app.arrival_date ? new Date(app.arrival_date as string) : null;
  const departureDate = app.departure_date ? new Date(app.departure_date as string) : null;
  const passportExpiry = app.passport_expiry_date ? new Date(app.passport_expiry_date as string) : null;

  // 1. Passport expiry must be 6+ months after arrival
  if (arrivalDate && passportExpiry) {
    const minExpiry = new Date(arrivalDate);
    minExpiry.setMonth(minExpiry.getMonth() + 6);
    if (passportExpiry < minExpiry) {
      errors.push({
        field: "passportExpiryDate",
        message: `Passport expires ${passportExpiry.toISOString().split("T")[0]} — must be valid for at least 6 months after arrival (${minExpiry.toISOString().split("T")[0]})`,
      });
    }
  } else if (!passportExpiry) {
    errors.push({ field: "passportExpiryDate", message: "Passport expiry date is required" });
  }

  // 2. Departure within 60 days of arrival (B211A max stay)
  if (arrivalDate && departureDate) {
    const maxDeparture = new Date(arrivalDate);
    maxDeparture.setDate(maxDeparture.getDate() + 60);
    if (departureDate > maxDeparture) {
      errors.push({
        field: "departureDate",
        message: `Stay exceeds 60 days (B211A limit). Departure must be by ${maxDeparture.toISOString().split("T")[0]}`,
      });
    }
    if (departureDate <= arrivalDate) {
      errors.push({ field: "departureDate", message: "Departure date must be after arrival date" });
    }
  }

  // 3. Required documents
  const REQUIRED_DOCS = ["passport_copy", "photo", "flight_booking", "hotel_booking", "travel_itinerary", "bank_statement"];
  const missingDocs = REQUIRED_DOCS.filter(d => !docs.includes(d));
  if (missingDocs.length > 0) {
    errors.push({
      field: "documents",
      message: `Missing required documents: ${missingDocs.join(", ")}`,
    });
  }

  // 4. Arrival date must be in the future
  if (arrivalDate && arrivalDate < new Date()) {
    warnings.push({ field: "arrivalDate", message: "Arrival date is in the past — please verify" });
  }

  return { errors, warnings };
}

// Get embedding from OpenAI
async function getEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "your_openai_api_key_here") return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    const data = await res.json() as { data?: Array<{embedding: number[]}> };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// Fetch relevant visa knowledge chunks
async function getKnowledgeContext(supabase: ReturnType<typeof getSupabaseClient>): Promise<string> {
  const embedding = await getEmbedding("Indonesia B211A tourist visa requirements passport expiry travel dates documents");

  if (embedding) {
    const { data } = await supabase.rpc("match_visa_chunks", {
      query_embedding: embedding,
      match_count: 5,
      filter_visa_type: "tourist_b211a",
    });
    if (data && data.length > 0) {
      return (data as Array<{content: string}>).map(c => c.content).join("\n\n");
    }
  }

  // Fallback: load static knowledge
  return `Indonesia B211A Tourist Visa Requirements:
- Passport valid for at least 6 months beyond intended departure date
- Single entry, maximum stay 60 days (extendable to 180 days total)
- Required documents: passport copy, passport-size photo, flight booking, hotel booking, travel itinerary, bank statement (3 months)
- Application via evisa.imigrasi.go.id
- Processing time: 5 working days
- Fee: IDR 1,000,000 (~$65 USD)`;
}

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { applicationId } = req.body as { applicationId?: string };

  if (!applicationId) {
    res.status(400).json({ error: "applicationId is required" });
    return;
  }

  const supabase = getSupabaseClient();

  // Load application
  const { data: appData, error: appError } = await supabase
    .from("applications")
    .select("*, applicant_profiles(*), application_documents(document_type, status)")
    .eq("id", applicationId)
    .single();

  if (appError || !appData) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const app = appData as Record<string, unknown>;
  const applicant = (app.applicant_profiles as Record<string, unknown> | null) ?? {};
  const docs = ((app.application_documents as Array<{document_type: string; status: string}>) ?? [])
    .filter(d => d.status !== "rejected")
    .map(d => d.document_type);

  // Merge application + applicant for validation
  const fullProfile = { ...applicant, ...app };

  // Run hard rules first
  const { errors: hardErrors, warnings: hardWarnings } = runHardRules(fullProfile, docs);

  // Run Claude validation if API key is available
  const allErrors: FieldError[] = [...hardErrors];
  const allWarnings: FieldError[] = [...hardWarnings];

  if (ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== "your_anthropic_api_key_here") {
    try {
      const knowledgeContext = await getKnowledgeContext(supabase);
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

      const appSummary = JSON.stringify({
        full_name: applicant.full_name,
        nationality: applicant.nationality,
        passport_number: applicant.passport_number,
        passport_expiry: applicant.passport_expiry_date,
        arrival_date: app.arrival_date,
        departure_date: app.departure_date,
        port_of_entry: app.port_of_entry,
        purpose: app.purpose,
        accommodation: app.accommodation_name,
        uploaded_documents: docs,
      }, null, 2);

      const message = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: `You are a visa application validator for Indonesia B211A tourist visa. Review the application data against the requirements context provided. Return ONLY valid JSON in this exact format, no other text:
{"valid":boolean,"errors":[{"field":"string","message":"string"}],"warnings":[{"field":"string","message":"string"}]}`,
        messages: [{
          role: "user",
          content: `Requirements context:\n${knowledgeContext}\n\nApplication data:\n${appSummary}\n\nValidate this application. Check for: passport validity, stay duration, document completeness, and any other issues. Return JSON only.`,
        }],
      });

      const responseText = (message.content[0] as {type: string; text: string}).text.trim();

      // Extract JSON even if there's surrounding text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { errors?: FieldError[]; warnings?: FieldError[] };
        if (Array.isArray(parsed.errors)) allErrors.push(...parsed.errors);
        if (Array.isArray(parsed.warnings)) allWarnings.push(...parsed.warnings);
      }
    } catch (err: any) {
      logger.error("Claude validation failed", new Error("Claude validation failed"), { error: err.message });
      // Don't block submission on Claude failure — hard rules already ran
    }
  }

  // Deduplicate errors by field+message
  const dedup = (arr: FieldError[]) => arr.filter(
    (a, i, self) => self.findIndex(b => b.field === a.field && b.message === a.message) === i
  );

  const result: ValidationResult = {
    valid: allErrors.length === 0,
    errors: dedup(allErrors),
    warnings: dedup(allWarnings),
    blocked: allErrors.length > 0,
  };

  logger.info("Validation complete", {
    applicationId,
    valid: result.valid,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
  });

  res.status(200).json(result);
});

export default router;

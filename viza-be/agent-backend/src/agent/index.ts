import Anthropic from "@anthropic-ai/sdk";
import { Logger } from "../utils/logger.js";
import { getSupabaseClient } from "../db/supabase-client.js";

const logger = new Logger({ serviceName: "VisaAgent" });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const BASE_SYSTEM_PROMPT = `You are VIZA, a friendly and knowledgeable AI assistant that helps people with Indonesian visa applications.

Your capabilities:
- Explain visa types (tourist, business, social/cultural, etc.) and their requirements
- Guide users through the application process step by step
- Answer questions about required documents, fees, processing times
- Help users understand eligibility requirements
- Provide tips for a successful application

Guidelines:
- Be concise and helpful. Use short paragraphs.
- If you're unsure about specific details (fees, processing times), say so and recommend checking official sources.
- Never fabricate visa requirements or official policies.
- Be encouraging but honest about potential issues.
- When listing requirements, use clear formatting.
- Respond in the same language the user writes in.`;

// =============================================================================
// Application Context Builder (US-036)
// =============================================================================

interface ApplicationContext {
  profile: Record<string, string | null> | null;
  application: Record<string, string | null> | null;
}

/**
 * Fetch applicant profile and active application for a user from Supabase.
 * Returns null on failure (non-fatal).
 */
export async function buildApplicationContext(
  userId: string
): Promise<ApplicationContext> {
  try {
    const supabase = getSupabaseClient();

    const { data: profile } = await supabase
      .from("applicant_profiles")
      .select(
        "id, full_name, date_of_birth, nationality, passport_number, passport_expiry_date, email, phone"
      )
      .eq("auth_user_id", userId)
      .maybeSingle();

    const { data: application } = await supabase
      .from("applications")
      .select("id, status, visa_type, country, arrival_date, departure_date, port_of_entry")
      .eq("applicant_id", profile?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      profile: profile
        ? {
            full_name: profile.full_name ?? null,
            date_of_birth: profile.date_of_birth ?? null,
            nationality: profile.nationality ?? null,
            passport_number: profile.passport_number ?? null,
            passport_expiry_date: profile.passport_expiry_date ?? null,
            email: profile.email ?? null,
            phone: profile.phone ?? null,
          }
        : null,
      application: application
        ? {
            id: application.id ?? null,
            status: application.status ?? null,
            visa_type: application.visa_type ?? null,
            country: application.country ?? null,
            arrival_date: application.arrival_date ?? null,
            departure_date: application.departure_date ?? null,
            port_of_entry: application.port_of_entry ?? null,
          }
        : null,
    };
  } catch (err) {
    logger.warn("Failed to build application context", err as Error, { userId });
    return { profile: null, application: null };
  }
}

/**
 * Build a dynamic system prompt that includes the user's application context.
 */
export function buildSystemPrompt(context: ApplicationContext): string {
  const sections: string[] = [BASE_SYSTEM_PROMPT];

  if (context.profile) {
    const p = context.profile;
    const profileLines: string[] = [];
    if (p.full_name) profileLines.push(`Name: ${p.full_name}`);
    if (p.nationality) profileLines.push(`Nationality: ${p.nationality}`);
    if (p.date_of_birth) profileLines.push(`Date of birth: ${p.date_of_birth}`);
    if (p.passport_number) profileLines.push(`Passport: ${p.passport_number} (expires ${p.passport_expiry_date ?? "unknown"})`);
    if (p.email) profileLines.push(`Email: ${p.email}`);
    if (profileLines.length > 0) {
      sections.push(`\nApplicant profile:\n${profileLines.join("\n")}`);
    }
  }

  if (context.application) {
    const a = context.application;
    const appLines: string[] = [];
    if (a.visa_type) appLines.push(`Visa type: ${a.visa_type}`);
    if (a.country) appLines.push(`Country: ${a.country}`);
    if (a.status) appLines.push(`Application status: ${a.status}`);
    if (a.arrival_date) appLines.push(`Arrival date: ${a.arrival_date}`);
    if (a.departure_date) appLines.push(`Departure date: ${a.departure_date}`);
    if (a.port_of_entry) appLines.push(`Port of entry: ${a.port_of_entry}`);
    if (a.id) appLines.push(`Application ID: ${a.id}`);
    if (appLines.length > 0) {
      sections.push(`\nCurrent application:\n${appLines.join("\n")}`);
    }
  }

  return sections.join("\n");
}

// =============================================================================
// Stream Chat (US-036: accepts dynamic systemPrompt)
// =============================================================================

interface StreamCallbacks {
  onToken: (text: string) => void;
  onComplete: (fullResponse: string) => void | Promise<void>;
  onError: (error: Error) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function streamChat(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  systemPrompt?: string
): Promise<void> {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "your_anthropic_api_key_here") {
    const fallback =
      "I'm sorry, the AI service is not configured yet. Please contact support.";
    callbacks.onToken(fallback);
    callbacks.onComplete(fallback);
    return;
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  try {
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1024,
      system: systemPrompt ?? BASE_SYSTEM_PROMPT,
      messages,
    });

    let fullResponse = "";

    stream.on("text", (text) => {
      fullResponse += text;
      callbacks.onToken(text);
    });

    await stream.finalMessage();
    await callbacks.onComplete(fullResponse);
  } catch (err) {
    logger.error("Streaming error", err as Error);
    callbacks.onError(err as Error);
  }
}


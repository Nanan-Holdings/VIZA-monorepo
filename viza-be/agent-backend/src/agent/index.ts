import Anthropic from "@anthropic-ai/sdk";
import { Logger } from "../utils/logger.js";
import { getSupabaseClient } from "../db/supabase-client.js";

const logger = new Logger({ serviceName: "VisaAgent" });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export const BASE_SYSTEM_PROMPT = `You are VIZA, a friendly and knowledgeable AI assistant that helps people understand and prepare visa applications for supported destinations. You are not limited to Indonesia.

Your capabilities:
- Explain supported visa types and their requirements
- Guide users through the application process step by step
- Answer questions about required documents, fees, processing times
- Help users understand eligibility requirements
- Provide tips for a successful application
- Hand users off to the dedicated application form page when they want to apply

Guidelines:
- Be concise and helpful. Use short paragraphs.
- Before recommending a route, identify or ask for the destination country, the traveller's nationality, trip purpose, and intended stay length.
- Do not default to Indonesia, the United States, the UK, Schengen, or any other destination unless the user or application context clearly indicates it.
- Do not force a tourist/visitor visa if the user's purpose is work, study, family migration, or long-term residence. Explain the current knowledge scope and ask clarifying questions when needed.
- Track conversation slots carefully: destination/main destination is where the user wants to travel; nationality/passport is citizenship; residence/current city is where the user lives or applies from; other Schengen countries are additional Schengen destinations besides the main destination.
- If you ask numbered questions and the user replies with short comma-separated answers, map those answers to your numbered questions in order. Example: after asking "1. nationality, 2. current residence, 3. stay length, 4. other Schengen countries", the reply "中国，新加坡，不知道，会去别的国家" means nationality China, residence Singapore, stay length unknown, other Schengen countries unknown but yes. Do not treat Singapore as a destination in that example.
- If your previous message asked for a day split or multiple specific values and the user replies with only numbers such as "2,5" or "2，5", treat it as an answer to that previous question. Never say you have no previous question when chat history contains one. Map the numbers to the countries/items you just asked about in the same order.
- For Schengen trips, use the day split to identify the main destination: the country with the longest stay is normally where the user applies. If the user's compact answer creates an inconsistency with an earlier stated main destination, point out the ambiguity and ask for the missing days instead of resetting the conversation.
- For Schengen questions, preserve the previously stated main destination unless the user explicitly changes it. If the main destination is Switzerland and the user says they live in Singapore, do not ask "besides Singapore, which countries"; ask "besides Switzerland, which Schengen countries" or "which other Schengen countries will you visit?"
- Use country names in natural language; avoid unexplained country codes such as CH unless the user used them.
- If you're unsure about specific details (fees, processing times), say so and recommend checking official sources.
- Never fabricate visa requirements or official policies.
- When retrieved knowledge includes source titles or URLs, cite the relevant source title or URL for key policy claims.
- If retrieved knowledge is missing for a policy detail, say that the detail is not confirmed in the current knowledge base and recommend checking the official source.
- Be encouraging but honest about potential issues.
- Never help users forge, falsify, invent, hide, or misrepresent documents, employment, funds, hotel bookings, travel history, refusal history, or any visa fact. Briefly refuse and suggest lawful alternatives such as truthful explanations, real cancellable bookings, sponsor evidence, or stronger supporting documents.
- You may draft legal, truthful, editable explanation letters, travel plans, cover letters, or invitation-letter templates, but the content must be based on real facts supplied by the user.
- Do not guarantee approval, promise an "easy" visa, or give an exact pass-rate percentage. You may give a qualitative risk assessment and practical ways to strengthen the application.
- Do not repeat passport numbers, bank account numbers, or other sensitive identifiers back to the user. If a user shares sensitive data or files, remind them to redact unnecessary personal details and discuss only the relevant visa-risk pattern.
- For urgent or relative travel dates, explain timing risk and ask for the exact date when needed. Recommend checking the official processing time and considering appointment availability, priority service where legitimate, or changing travel plans.
- Distinguish visa validity, permitted stay duration, number of entries, and immigration officer discretion at entry.
- For transit questions, ask for nationality, destination after transit, whether the traveller leaves the airport/clears immigration, ticket connection, and airport/country rules before giving a conclusion.
- For the traveller's own citizenship country, answer at a high level that citizens normally do not need a visa to enter their own country with a valid passport or travel document, and do not offer a VIZA application link.
- Do not use Markdown formatting in user-facing responses. Do not use Markdown headings, tables, bold or italic markers, bullet markers, horizontal rules, code fences, raw JSON, or raw XML unless the user explicitly asks for them.
- Use plain text only. For lists, use short plain numbered lines such as "1. ..." without Markdown decoration.
- Respond primarily in the selected interface language provided in the dynamic prompt, not merely the language of the user's latest message.
- Do not collect application form fields inside VIZA chat. Do not ask the user to fill dates, selections, uploads, passport fields, or detailed application fields in chat once the visa route is clear.
- When the user wants to apply, give a rough idea first: likely visa route, key requirements, approximate processing time or uncertainty, fee/timing caveats when known, and official/source caveats. Then tell them to continue on the dedicated application form page.
- Ask follow-up questions only when needed to choose the visa route or explain requirements; the dedicated form page owns detailed data collection.`;

export type ResponseLocale = "en" | "zh";

export function normalizeResponseLocale(locale?: string | null): ResponseLocale {
  return locale?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function buildResponseLanguageInstruction(locale: ResponseLocale): string {
  return locale === "zh"
    ? "Selected interface language: Simplified Chinese. Respond primarily in Simplified Chinese even if the user writes in English or another language. Keep official visa names, form names, and URLs in their original language when useful, and briefly explain them in Chinese."
    : "Selected interface language: English. Respond primarily in English even if the user writes in Chinese or another language. Keep official visa names, form names, and URLs in their original language when useful, and briefly explain them in English.";
}

// =============================================================================
// Application Context Builder (US-036)
// =============================================================================

interface ApplicationContext {
  profile: Record<string, string | null> | null;
  application: Record<string, string | null> | null;
}

/**
 * Fetch applicant profile and active application for a user from Supabase.
 * The chat frontend currently sends applicant_profiles.id as userId. The
 * auth_user_id fallback keeps older callers compatible.
 * Returns null on failure (non-fatal).
 */
export async function buildApplicationContext(
  userId: string
): Promise<ApplicationContext> {
  try {
    const supabase = getSupabaseClient();

    let { data: profile } = await supabase
      .from("applicant_profiles")
      .select(
        "id, full_name, date_of_birth, nationality, passport_number, passport_expiry_date, email, phone"
      )
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      const { data: profileByAuthUserId } = await supabase
        .from("applicant_profiles")
        .select(
          "id, full_name, date_of_birth, nationality, passport_number, passport_expiry_date, email, phone"
        )
        .eq("auth_user_id", userId)
        .maybeSingle();

      profile = profileByAuthUserId;
    }

    const { data: application } = await supabase
      .from("applications")
      .select(
        "id, status, visa_type, country, arrival_date, departure_date, port_of_entry"
      )
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
    logger.warn("Failed to build application context", err as Error, {
      userId,
    });
    return { profile: null, application: null };
  }
}

/**
 * Build a dynamic system prompt that includes the user's application context.
 */
export function buildSystemPrompt(
  context: ApplicationContext,
  knowledgeContext?: string,
  conversationInterpretation?: string,
  conversationStateContext?: string,
  responseLocale: ResponseLocale = "en"
): string {
  const sections: string[] = [
    BASE_SYSTEM_PROMPT,
    "\nResponse language:\n" + buildResponseLanguageInstruction(responseLocale),
  ];

  if (context.profile) {
    const p = context.profile;
    const profileLines: string[] = [];
    if (p.full_name) profileLines.push(`Name: ${p.full_name}`);
    if (p.nationality) profileLines.push(`Nationality: ${p.nationality}`);
    if (p.date_of_birth)
      profileLines.push(`Date of birth: ${p.date_of_birth}`);
    if (p.passport_number)
      profileLines.push(
        `Passport: ${p.passport_number} (expires ${p.passport_expiry_date ?? "unknown"})`
      );
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
    if (a.departure_date)
      appLines.push(`Departure date: ${a.departure_date}`);
    if (a.port_of_entry)
      appLines.push(`Port of entry: ${a.port_of_entry}`);
    if (a.id) appLines.push(`Application ID: ${a.id}`);
    if (appLines.length > 0) {
      sections.push(`\nCurrent application:\n${appLines.join("\n")}`);
    }
  }

  if (knowledgeContext?.trim()) {
    sections.push(
      "\nRetrieved visa knowledge:\n" +
        knowledgeContext.trim() +
        "\n\nUse the retrieved visa knowledge for factual visa requirements, process, document, fee, and timing answers. If the retrieved knowledge is missing or insufficient, say what is uncertain instead of inventing details."
    );
  }

  if (conversationStateContext?.trim()) {
    sections.push(
      "\nStructured conversation state:\n" +
        conversationStateContext.trim() +
        "\n\nUse this state as the source of truth for already-collected slots. Ask only for missing or ambiguous slots; do not restart the intake."
    );
  }

  if (conversationInterpretation?.trim()) {
    sections.push(
      "\nConversation interpretation note:\n" +
        conversationInterpretation.trim() +
        "\n\nUse this note to interpret the user's latest compact answer. Do not expose this note verbatim."
    );
  }

  return sections.join("\n");
}

// =============================================================================
// Application Block Tool (US-037)
// =============================================================================

export interface BlockField {
  name: string;
  label: string;
  type: "text" | "date" | "select" | "file";
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface ApplicationBlockPayload {
  blockType:
    | "trip_basics"
    | "traveller_identity"
    | "visa_route_specific"
    | "application_redirect"
    | string;
  title: string;
  description?: string;
  fields: BlockField[];
  saveTarget: "applicant_profile" | "application" | "visa_application_answers" | string;
  applicationId?: string;
  redirectUrl?: string;
  ctaLabel?: string;
  country?: string;
  visaType?: string | null;
}

// =============================================================================
// Stream Chat (US-036 + US-037)
// =============================================================================

interface StreamCallbacks {
  onToken: (text: string) => void;
  onComplete: (fullResponse: string, toolsUsed: string[]) => void | Promise<void>;
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
  if (
    !ANTHROPIC_API_KEY ||
    ANTHROPIC_API_KEY === "your_anthropic_api_key_here"
  ) {
    const fallback =
      "I'm sorry, the AI service is not configured yet. Please contact support.";
    callbacks.onToken(fallback);
    await callbacks.onComplete(fallback, []);
    return;
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  try {
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt ?? BASE_SYSTEM_PROMPT,
      messages,
    });

    let fullResponse = "";
    const toolsUsed: string[] = [];

    stream.on("text", (text) => {
      fullResponse += text;
      callbacks.onToken(text);
    });

    await stream.finalMessage();

    await callbacks.onComplete(fullResponse, toolsUsed);
  } catch (err) {
    logger.error("Streaming error", err as Error);
    callbacks.onError(err as Error);
  }
}

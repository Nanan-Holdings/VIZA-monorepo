import Anthropic from "@anthropic-ai/sdk";
import { Logger } from "../utils/logger.js";
import { getSupabaseClient } from "../db/supabase-client.js";

const logger = new Logger({ serviceName: "VisaAgent" });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const BASE_SYSTEM_PROMPT = `You are VIZA, a friendly and knowledgeable AI assistant that helps people understand and prepare visa applications for supported destinations. You are not limited to Indonesia.

Your capabilities:
- Explain supported visa types and their requirements
- Guide users through the application process step by step
- Answer questions about required documents, fees, processing times
- Help users understand eligibility requirements
- Provide tips for a successful application
- Collect application data from the user via interactive form blocks

Guidelines:
- Be concise and helpful. Use short paragraphs.
- Before recommending a route, identify or ask for the destination country, the traveller's nationality, trip purpose, and intended stay length.
- Do not default to Indonesia, the United States, the UK, Schengen, or any other destination unless the user or application context clearly indicates it.
- Do not force a tourist/visitor visa if the user's purpose is work, study, family migration, or long-term residence. Explain the current knowledge scope and ask clarifying questions when needed.
- If you're unsure about specific details (fees, processing times), say so and recommend checking official sources.
- Never fabricate visa requirements or official policies.
- Be encouraging but honest about potential issues.
- When listing requirements, use clear formatting.
- Respond in the same language the user writes in.
- When you need to collect structured data from the user (dates, selections, file uploads), use the send_application_block tool.`;

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
  knowledgeContext?: string
): string {
  const sections: string[] = [BASE_SYSTEM_PROMPT];

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
  blockType: string;
  title: string;
  description?: string;
  fields: BlockField[];
  saveTarget: string;
  applicationId?: string;
}

/** The Anthropic tool definition for send_application_block */
const SEND_APPLICATION_BLOCK_TOOL: Anthropic.Tool = {
  name: "send_application_block",
  description:
    "Send an interactive form block to the user to collect structured application data. " +
    "Use this when you need the user to fill in dates, make selections, upload files, or enter specific field values. " +
    "The block will appear inline in the chat and the user's response will be saved automatically.",
  input_schema: {
    type: "object",
    properties: {
      blockType: {
        type: "string",
        description:
          "The category of data being collected (e.g. 'travel_dates', 'personal_info', 'document_upload')",
      },
      title: {
        type: "string",
        description: "Short title displayed at the top of the block",
      },
      description: {
        type: "string",
        description:
          "Optional helper text shown below the title to guide the user",
      },
      fields: {
        type: "array",
        description: "List of form fields to render",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Field identifier (snake_case, matches application column name)",
            },
            label: {
              type: "string",
              description: "Human-readable label shown next to the field",
            },
            type: {
              type: "string",
              enum: ["text", "date", "select", "file"],
              description: "Input type for the field",
            },
            required: {
              type: "boolean",
              description: "Whether the field must be filled before submitting",
            },
            options: {
              type: "array",
              items: { type: "string" },
              description: "Allowed values for select fields",
            },
            placeholder: {
              type: "string",
              description: "Placeholder hint shown inside the field",
            },
          },
          required: ["name", "label", "type"],
        },
      },
      saveTarget: {
        type: "string",
        description:
          "Which table/record to save the data to (e.g. 'application', 'applicant_profile')",
      },
      applicationId: {
        type: "string",
        description:
          "UUID of the application record to update (required when saveTarget is 'application')",
      },
    },
    required: ["blockType", "title", "fields", "saveTarget"],
  },
};

// =============================================================================
// Stream Chat (US-036 + US-037)
// =============================================================================

interface StreamCallbacks {
  onToken: (text: string) => void;
  onComplete: (fullResponse: string, toolsUsed: string[]) => void | Promise<void>;
  onError: (error: Error) => void;
  onToolUse?: (toolName: string, toolInput: ApplicationBlockPayload) => void | Promise<void>;
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
      tools: [SEND_APPLICATION_BLOCK_TOOL],
      messages,
    });

    let fullResponse = "";
    const toolsUsed: string[] = [];

    stream.on("text", (text) => {
      fullResponse += text;
      callbacks.onToken(text);
    });

    const finalMsg = await stream.finalMessage();

    // Process tool_use blocks from the final message
    for (const block of finalMsg.content) {
      if (block.type === "tool_use" && block.name === "send_application_block") {
        toolsUsed.push(block.name);
        const toolInput = block.input as ApplicationBlockPayload;
        if (callbacks.onToolUse) {
          await callbacks.onToolUse(block.name, toolInput);
        }
      }
    }

    await callbacks.onComplete(fullResponse, toolsUsed);
  } catch (err) {
    logger.error("Streaming error", err as Error);
    callbacks.onError(err as Error);
  }
}

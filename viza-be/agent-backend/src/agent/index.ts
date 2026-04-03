import Anthropic from "@anthropic-ai/sdk";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "VisaAgent" });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are VIZA, a friendly and knowledgeable AI assistant that helps people with Indonesian visa applications.

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
      system: SYSTEM_PROMPT,
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

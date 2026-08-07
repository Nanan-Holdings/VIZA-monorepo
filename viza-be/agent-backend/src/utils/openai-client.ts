import OpenAI from "openai";

/**
 * Builds the shared OpenAI-compatible client.
 *
 * `OPENAI_BASE_URL` lets the backend point at any provider that speaks the
 * OpenAI wire format (DeepSeek, Azure-style gateways, a local proxy). Leave it
 * unset for api.openai.com. Model ids still come from the per-feature
 * `OPENAI_*_MODEL` vars, because they are provider-specific.
 */
export function createOpenAiClient(
  apiKey: string,
  options: { maxRetries?: number; timeout?: number } = {},
): OpenAI {
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  return new OpenAI({
    apiKey,
    ...options,
    ...(baseURL ? { baseURL } : {}),
  });
}

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("provider capacity wiring", () => {
  it("wraps every non-chat OpenAI request in the shared provider gate", () => {
    const passport = source("../routes/passport-scan.routes.ts");
    const validation = source("../routes/validate-application.ts");
    const guidance = source("../routes/field-guidance.routes.ts");
    const knowledge = source("../services/visa-knowledge.service.ts");

    expect(passport).toMatch(/runWithProviderCapacity\(\(signal\) => client\.responses\.create/u);
    expect(validation.match(/runWithProviderCapacity\(/gu)).toHaveLength(2);
    expect(validation).toMatch(/runWithProviderCapacity\(async \(signal\)[\s\S]*?fetch\("https:\/\/api\.openai\.com\/v1\/embeddings"[\s\S]*?await response\.json\(\)/u);
    expect(validation).toContain("}, { signal }), requestSignal)");
    expect(guidance.match(/runWithProviderCapacity\(/gu)).toHaveLength(2);
    expect(guidance.match(/\}, \{ signal \}\), requestSignal\)/gu)).toHaveLength(2);
    expect(passport).toContain("}, { signal }), requestSignal)");
    expect(knowledge).toMatch(/runWithProviderCapacity\(async \(signal\)[\s\S]*?fetch\("https:\/\/api\.openai\.com\/v1\/embeddings"[\s\S]*?await response\.json\(\)/u);
    expect(knowledge).toContain("}, requestSignal)");
  });

  it("keeps chat on its independent request-level capacity gate", () => {
    const agent = source("../agent/index.ts");
    const namespace = source("../socket/visa-namespace.ts");

    expect(agent).not.toContain("runWithProviderCapacity");
    expect(namespace).toContain("getChatConcurrencyGate().acquire");
  });
});

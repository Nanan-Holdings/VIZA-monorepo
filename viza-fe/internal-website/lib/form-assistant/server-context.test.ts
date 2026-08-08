import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SEARCHABLE_VISA_DESTINATIONS } from "@/lib/visa-destinations";
import { shouldUseRagVisitorIntakeFallback } from "@/lib/rag-visitor-intake-form";
import { resolveVisaFormSchemaVisaType } from "@/lib/visa-form-schema-aliases";

vi.mock("server-only", () => ({}));

import { loadAssistantSchema } from "./server-context";

function adminWithFormRows(rows: Array<Record<string, unknown>>): SupabaseClient {
  const result = { data: rows, error: null };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.then = (
    resolve: (value: typeof result) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient;
}

describe("loadAssistantSchema", () => {
  it.each([
    ["germany", "tourist_evisa"],
    ["canada", "visitor_visa_or_evisa"],
    ["japan", "short_term_tourism_evisa"],
  ])("uses the same DB-free visitor intake fallback as the form for %s %s", async (country, visaType) => {
    const steps = await loadAssistantSchema(adminWithFormRows([]), country, visaType);

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.flatMap((step) => step.fields).map((field) => field.fieldName)).toEqual(
      expect.arrayContaining(["full_name", "passport_number", "arrival_date"]),
    );
  });

  it("loads an assistant schema for every current DB-free selectable form", async () => {
    const fallbackProducts = SEARCHABLE_VISA_DESTINATIONS
      .map((destination) => ({
        ...destination,
        schemaVisaType: resolveVisaFormSchemaVisaType(destination.visaType, destination.country),
      }))
      .filter((destination) => shouldUseRagVisitorIntakeFallback(destination.schemaVisaType));

    expect(fallbackProducts.length).toBeGreaterThan(20);
    const results = await Promise.all(fallbackProducts.map(async (product) => ({
      product,
      steps: await loadAssistantSchema(
        adminWithFormRows([]),
        product.country,
        product.visaType,
      ),
    })));

    expect(results.filter(({ steps }) => steps.length === 0).map(({ product }) => product.id)).toEqual([]);
  });

  it("does not invent a fallback for a normalized product whose reviewed schema is missing", async () => {
    expect(await loadAssistantSchema(
      adminWithFormRows([]),
      "united_states",
      "DS160",
    )).toEqual([]);
  });

  it("preserves a product-owned DB schema", async () => {
    const steps = await loadAssistantSchema(adminWithFormRows([{
      id: "field-id",
      visa_type: "SG_ARRIVAL_CARD",
      field_name: "full_name",
      field_label: "Full name",
      field_type: "text",
      is_required: true,
      step_number: 1,
      step_name: "Traveller",
      display_order: 1,
      placeholder: null,
      validation_rules: { label_zh: "护照姓名" },
      options: null,
      conditional_logic: null,
    }]), "singapore", "SG_ARRIVAL_CARD");

    expect(steps).toHaveLength(1);
    expect(steps[0]?.fields[0]).toMatchObject({
      fieldName: "full_name",
      visaType: "SG_ARRIVAL_CARD",
    });
  });
});

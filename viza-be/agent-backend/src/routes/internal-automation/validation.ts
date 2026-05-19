import { z } from "zod";

export const externalStatusValues = [
  "handoff_ready",
  "queued",
  "received",
  "in_progress",
  "submitted",
  "additional_information_required",
  "approved",
  "rejected",
  "failed",
  "cancelled",
] as const;

export const resultStatusValues = [
  "not_available",
  "pending",
  "received",
  "approved",
  "issued",
  "rejected",
  "refused",
] as const;

export const applicationIdParamsSchema = z.object({
  applicationId: z.string().uuid(),
});

const storageReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(1024)
  .refine((value) => !value.includes("?") && !value.includes("#"), {
    message: "Storage reference must not include signed URL query or fragment tokens",
  });

export const statusSummaryQuerySchema = z.object({
  includeEvents: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true"),
  eventLimit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const externalStatusUpdateSchema = z
  .object({
    applicationId: z.string().uuid(),
    externalStatus: z.enum(externalStatusValues),
    externalReference: z.string().trim().min(1).max(160).nullable().optional(),
    resultStatus: z.enum(resultStatusValues).optional(),
    resultStoragePath: storageReferenceSchema.nullable().optional(),
    resultNotes: z.string().trim().min(1).max(2000).nullable().optional(),
    source: z.string().trim().min(1).max(100).optional().default("external_submission"),
    occurredAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const externalStatusPathBodySchema = externalStatusUpdateSchema
  .omit({ applicationId: true })
  .strict();

export type ExternalStatusUpdateInput = z.infer<typeof externalStatusUpdateSchema>;

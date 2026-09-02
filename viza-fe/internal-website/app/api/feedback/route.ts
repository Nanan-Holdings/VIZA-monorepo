import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const feedbackSchema = z.object({
  experienceRating: z.number().int().min(1).max(5),
  easeRating: z.number().int().min(1).max(5),
  task: z.enum(["sign-up", "choose-visa", "application", "documents", "assistant", "payment", "status", "travel", "other"]),
  feedbackType: z.enum(["bug", "confusing", "missing", "idea", "praise"]),
  description: z.string().trim().min(10).max(4000),
  reproduceSteps: z.string().trim().max(2000).optional().default(""),
  expectedResult: z.string().trim().max(2000).optional().default(""),
  environment: z.string().trim().max(300).optional().default(""),
  contactConsent: z.boolean(),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  locale: z.enum(["en", "zh"]),
  elapsedMs: z.number().int().min(1200).max(7_200_000),
  company: z.string().max(0),
}).superRefine((value, context) => {
  if (value.contactConsent && !value.email) {
    context.addIssue({ code: "custom", path: ["email"], message: "Email is required when contact is permitted." });
  }
});

type BetaFeedbackClient = {
  from: (table: "beta_feedback") => {
    insert: (value: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

function originIsAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!originIsAllowed(request)) {
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return Response.json({ error: "Invalid request." }, { status: 415 });
  }

  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid feedback." }, { status: 400 });
  }

  const input = parsed.data;
  const feedback = createAdminClient() as unknown as BetaFeedbackClient;
  const { error } = await feedback.from("beta_feedback").insert({
    experience_rating: input.experienceRating,
    ease_rating: input.easeRating,
    task: input.task,
    feedback_type: input.feedbackType,
    description: input.description,
    reproduce_steps: input.reproduceSteps || null,
    expected_result: input.expectedResult || null,
    environment: input.environment || null,
    contact_consent: input.contactConsent,
    tester_email: input.contactConsent ? input.email || null : null,
    locale: input.locale,
  });

  if (error) {
    console.error("Unable to save beta feedback", { message: error.message });
    return Response.json({ error: "Feedback is temporarily unavailable." }, { status: 503 });
  }

  return Response.json({ ok: true }, { status: 201 });
}

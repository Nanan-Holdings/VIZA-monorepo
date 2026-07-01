import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveKvacCenter, type KvacRoutingInput } from "@/lib/korea-c39/kvac-routing";

type Action = "start-slot-search" | "select-slot" | "confirm-booking" | "refresh-status";

interface AppointmentJobRow {
  id: string;
  application_id: string;
  user_id: string;
  status: string;
  mode: string;
  scheduling_provider: string | null;
  user_preferences_json: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

type ApplicationAuthResult =
  | { ok: false; response: Response }
  | {
      ok: true;
      admin: ReturnType<typeof createAdminClient>;
      user: { id: string };
      profile: { id: string };
      application: { id: string; applicant_id: string; visa_type: string; country: string | null };
    };

async function requireApplication(applicationId: string): Promise<ApplicationAuthResult> {
  const admin = createAdminClient();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, response: NextResponse.json({ error: "Profile not found" }, { status: 404 }) };

  const { data: application, error } = await admin
    .from("applications")
    .select("id, applicant_id, visa_type, country")
    .eq("id", applicationId)
    .maybeSingle();
  if (error || !application) return { ok: false, response: NextResponse.json({ error: "Application not found" }, { status: 404 }) };
  if (application.applicant_id !== profile.id) return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  if (application.visa_type !== "KR_C39_SHORT_TERM_VISIT") {
    return { ok: false, response: NextResponse.json({ error: "Korea appointment only supports KR_C39_SHORT_TERM_VISIT" }, { status: 400 }) };
  }
  return { ok: true, admin, user: { id: user.id }, profile, application };
}

async function latestJob(admin: ReturnType<typeof createAdminClient>, applicationId: string) {
  const { data, error } = await admin
    .from("appointment_assistance_jobs")
    .select("*")
    .eq("application_id", applicationId)
    .eq("country_code", "KR")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AppointmentJobRow | null;
}

async function readSnapshot(admin: ReturnType<typeof createAdminClient>, applicationId: string) {
  const job = await latestJob(admin, applicationId);
  const routing = resolveKvacCenter({});
  if (!job) return { routing, job: null, slots: [], confirmation: null };

  const [{ data: slots, error: slotsErr }, { data: confirmation, error: confirmationErr }] = await Promise.all([
    admin
      .from("appointment_slots")
      .select("*")
      .eq("job_id", job.id)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true }),
    admin
      .from("appointment_confirmations")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (slotsErr) throw new Error(slotsErr.message);
  if (confirmationErr) throw new Error(confirmationErr.message);
  return { routing, job, slots: slots ?? [], confirmation: confirmation ?? null };
}

function dryRunSlots(centerCode: string) {
  const base = centerCode || "beijing";
  return [
    {
      appointment_date: "2026-09-08",
      appointment_time: "09:30",
      appointment_location: `KVAC ${base}`,
      appointment_type: "C-3-9 document intake",
      source: "dry_run",
      status: "observed",
      metadata_redacted_json: { centerCode: base },
    },
    {
      appointment_date: "2026-09-09",
      appointment_time: "14:00",
      appointment_location: `KVAC ${base}`,
      appointment_type: "C-3-9 document intake",
      source: "dry_run",
      status: "observed",
      metadata_redacted_json: { centerCode: base },
    },
  ];
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const auth = await requireApplication(id);
  if (!auth.ok) return auth.response;
  const snapshot = await readSnapshot(auth.admin, id);
  return NextResponse.json(snapshot);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const auth = await requireApplication(id);
  if (!auth.ok) return auth.response;
  const body = (await req.json().catch(() => ({}))) as {
    action?: Action;
    slotId?: string;
    routingInput?: KvacRoutingInput;
  };
  const action = body.action;
  const routing = resolveKvacCenter(body.routingInput ?? {});

  if (action === "refresh-status") {
    return NextResponse.json(await readSnapshot(auth.admin, id));
  }

  if (action === "start-slot-search") {
    let job = await latestJob(auth.admin, id);
    if (!job) {
      const { data, error } = await auth.admin
        .from("appointment_assistance_jobs")
        .insert({
          application_id: id,
          user_id: auth.user.id,
          country_code: "KR",
          visa_type: "KR_C39_SHORT_TERM_VISIT",
          applying_country_code: "CN",
          applying_post_city: routing.recommended.nameEn,
          scheduling_provider: "kvac_cn",
          status: "appointment_slots_observed",
          mode: "dry_run",
          user_preferences_json: {
            routing,
            centerCode: routing.recommended.code,
            finalConfirmationRequired: true,
            source: "korea_c39_v1",
          },
          requires_user_action: false,
          idempotency_key: `korea-kvac:${id}:${randomUUID()}`,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not create Korea appointment job.");
      job = data as AppointmentJobRow;
      await auth.admin.from("applications").update({
        appointment_assistance_status: "appointment_slots_observed",
        appointment_assistance_job_id: job.id,
      }).eq("id", id);
    }

    const slots = dryRunSlots(routing.recommended.code).map((slot) => ({
      ...slot,
      job_id: job.id,
      application_id: id,
    }));
    await auth.admin.from("appointment_slots").delete().eq("job_id", job.id).eq("source", "dry_run");
    const { error: slotErr } = await auth.admin.from("appointment_slots").insert(slots);
    if (slotErr) throw new Error(slotErr.message);
    return NextResponse.json(await readSnapshot(auth.admin, id));
  }

  if (action === "select-slot") {
    if (!body.slotId) return NextResponse.json({ error: "slotId is required" }, { status: 400 });
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "Start slot search first" }, { status: 400 });
    await auth.admin.from("appointment_slots").update({ status: "expired" }).eq("job_id", job.id).eq("status", "observed");
    const { error: slotErr } = await auth.admin.from("appointment_slots").update({ status: "user_selected" }).eq("id", body.slotId).eq("job_id", job.id);
    if (slotErr) throw new Error(slotErr.message);
    await auth.admin.from("appointment_assistance_jobs").update({ status: "appointment_slot_selection_required", updated_at: new Date().toISOString() }).eq("id", job.id);
    return NextResponse.json(await readSnapshot(auth.admin, id));
  }

  if (action === "confirm-booking") {
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "Start slot search first" }, { status: 400 });
    const { data: slot, error: slotErr } = await auth.admin
      .from("appointment_slots")
      .select("*")
      .eq("job_id", job.id)
      .in("status", ["user_selected", "selected"])
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (slotErr) throw new Error(slotErr.message);
    if (!slot) return NextResponse.json({ error: "Select a slot before confirming booking" }, { status: 400 });
    const confirmationNumber = `KR-DRYRUN-${String(slot.id).slice(0, 8).toUpperCase()}`;
    const { data: confirmation, error: confErr } = await auth.admin
      .from("appointment_confirmations")
      .insert({
        job_id: job.id,
        application_id: id,
        user_id: auth.user.id,
        country_code: "KR",
        visa_type: "KR_C39_SHORT_TERM_VISIT",
        appointment_date: slot.appointment_date,
        appointment_time: slot.appointment_time,
        appointment_location: slot.appointment_location,
        appointment_type: slot.appointment_type,
        confirmation_number: confirmationNumber,
        raw_confirmation_redacted_json: { mode: "dry_run", center: routing.recommended.code },
      })
      .select("*")
      .single();
    if (confErr || !confirmation) throw new Error(confErr?.message ?? "Could not confirm Korea appointment.");
    await auth.admin.from("appointment_assistance_jobs").update({
      status: "appointment_booked",
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    await auth.admin.from("applications").update({
      appointment_assistance_status: "appointment_booked",
      appointment_confirmation_id: confirmation.id,
    }).eq("id", id);
    return NextResponse.json(await readSnapshot(auth.admin, id));
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

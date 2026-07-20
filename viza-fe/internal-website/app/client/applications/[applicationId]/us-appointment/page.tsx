import { USAppointmentAssistant } from "@/components/client/us-appointment/us-appointment-assistant";

export const dynamic = "force-dynamic";

async function isWorkerReady() {
  const readinessUrl =
    process.env.US_APPOINTMENT_WORKER_READY_URL ??
    "https://viza-runner-united-states.fly.dev/ready";

  try {
    const response = await fetch(readinessUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return false;

    const payload = (await response.json()) as {
      status?: unknown;
      workerStarted?: unknown;
    };
    return payload.status === "ready" && payload.workerStarted !== false;
  } catch {
    return false;
  }
}

export default async function USAppointmentPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const [{ applicationId }, workerReady] = await Promise.all([
    params,
    isWorkerReady(),
  ]);
  return (
    <USAppointmentAssistant
      applicationId={applicationId}
      workerReady={workerReady}
    />
  );
}

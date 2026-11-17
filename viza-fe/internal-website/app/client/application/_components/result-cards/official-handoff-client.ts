/**
 * Open the applicant's live official session (migration 0209). The tab is
 * opened synchronously so popup blockers allow it, then pointed at the live
 * view once VIZA has verified ownership.
 */
export async function openOfficialHandoffWindow(
  applicationId: string,
): Promise<"opened" | "expired" | "unavailable"> {
  const popup = window.open("about:blank", "_blank");
  const response = await fetch(`/api/applications/${applicationId}/official-handoff`, {
    method: "POST",
    cache: "no-store",
  }).catch(() => null);
  const payload = response
    ? ((await response.json().catch(() => null)) as { liveViewUrl?: string; code?: string } | null)
    : null;
  if (!response?.ok || !payload?.liveViewUrl) {
    popup?.close();
    return payload?.code === "handoff_expired" || response?.status === 410 ? "expired" : "unavailable";
  }
  if (popup) popup.location.replace(payload.liveViewUrl);
  else window.location.assign(payload.liveViewUrl);
  return "opened";
}

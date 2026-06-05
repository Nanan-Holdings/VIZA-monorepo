export interface AppointmentBrowserContextRequest {
  mode: "dry_run" | "assisted_live" | "manual";
  headed?: boolean;
}

export interface AppointmentBrowserContextPlan {
  enabled: false;
  reason: string;
  headed: boolean;
  guardrails: string[];
}

export function createAppointmentBrowserContextPlan(
  request: AppointmentBrowserContextRequest,
): AppointmentBrowserContextPlan {
  return {
    enabled: false,
    reason:
      request.mode === "assisted_live"
        ? "Assisted live browser runner is scaffolded but disabled pending compliance approval."
        : "Dry-run and manual modes do not open official appointment portals.",
    headed: Boolean(request.headed),
    guardrails: [
      "no_captcha_solving",
      "no_proxy_rotation",
      "no_stealth_plugins",
      "no_hidden_browser_fingerprinting",
      "no_high_frequency_polling",
      "stop_on_site_policy_warning",
    ],
  };
}

export type CapacityTargetMode = "local-test" | "staging-only";

export interface CapacityTargetMarker {
  enabled: true;
  mode: CapacityTargetMode;
  projectRef: string;
}

function projectRefFromSupabaseUrl(value: string, mode: CapacityTargetMode): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("invalid_supabase_url");
  }

  const hostname = url.hostname.toLowerCase();
  if (mode === "local-test") {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
      throw new Error("local_target_requires_loopback");
    }
    return "local-test";
  }

  const match = /^([a-z0-9]{20})\.supabase\.co$/u.exec(hostname);
  if (!match?.[1]) throw new Error("staging_target_requires_exact_project_url");
  return match[1];
}

export function readCapacityTargetMarker(
  env: Readonly<Record<string, string | undefined>> = process.env,
): CapacityTargetMarker | null {
  if (env.ONLINE_CAPACITY_TARGET_ENABLED?.trim() !== "true") return null;

  const mode = env.ONLINE_CAPACITY_TARGET_MODE?.trim();
  if (mode !== "local-test" && mode !== "staging-only") {
    throw new Error("invalid_capacity_target_mode");
  }
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) throw new Error("missing_supabase_url");

  return {
    enabled: true,
    mode,
    projectRef: projectRefFromSupabaseUrl(supabaseUrl, mode),
  };
}

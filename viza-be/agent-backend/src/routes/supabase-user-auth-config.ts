export interface SupabaseUserAuthConfig {
  supabaseUrl: string;
  anonKey: string;
  supabaseUrlEnvName: string;
  anonKeyEnvName: string;
}

type EnvSource = Pick<NodeJS.ProcessEnv, string>;

function readFirstEnv(
  env: EnvSource,
  names: readonly string[],
): { name: string; value: string } | null {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return { name, value };
  }
  return null;
}

export function readSupabaseUserAuthConfig(
  env: EnvSource = process.env,
): SupabaseUserAuthConfig | null {
  const supabaseUrl = readFirstEnv(env, [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
  ]);
  const anonKey = readFirstEnv(env, [
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
  ]);

  if (!supabaseUrl || !anonKey) return null;

  return {
    supabaseUrl: supabaseUrl.value,
    anonKey: anonKey.value,
    supabaseUrlEnvName: supabaseUrl.name,
    anonKeyEnvName: anonKey.name,
  };
}

export function describeMissingSupabaseUserAuthEnv(
  env: EnvSource = process.env,
): string[] {
  const missing: string[] = [];
  if (!readFirstEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"])) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }
  if (!readFirstEnv(env, ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"])) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY");
  }
  return missing;
}

#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..", "..");
const originalEnvKeys = new Set(Object.keys(process.env));

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();
  if (!key) return null;

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadEnvFile(path, { overwrite = false } = {}) {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (originalEnvKeys.has(parsed.key)) continue;
    if (!overwrite && process.env[parsed.key] !== undefined) continue;
    process.env[parsed.key] = parsed.value;
  }
}

function getArg(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) return process.argv[index + 1];
  return undefined;
}

function generatePassword() {
  return `Viza-${randomBytes(12).toString("base64url")}!1`;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to viza-fe/internal-website/.env.local.`);
  }
  return value;
}

async function findAuthUserByEmail(adminClient, email) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (page <= 50) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const match = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (match) return match;
    if (data.users.length < 1000) return null;
    page += 1;
  }

  return null;
}

async function main() {
  loadEnvFile(resolve(repoRoot, ".env"));
  loadEnvFile(resolve(appRoot, ".env"));
  loadEnvFile(resolve(repoRoot, ".env.local"), { overwrite: true });
  loadEnvFile(resolve(appRoot, ".env.local"), { overwrite: true });

  const email = (getArg("email") ?? process.env.VIZA_ADMIN_EMAIL ?? "admin@viza.test")
    .trim()
    .toLowerCase();
  const name = (getArg("name") ?? process.env.VIZA_ADMIN_NAME ?? "VIZA Test Admin").trim();
  const role = (getArg("role") ?? process.env.VIZA_ADMIN_ROLE ?? "admin").trim();
  const providedPassword = getArg("password") ?? process.env.VIZA_ADMIN_PASSWORD;
  const password = providedPassword?.trim() || generatePassword();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Invalid email: ${email}`);
  }

  if (!["admin", "staff", "client"].includes(role)) {
    throw new Error("Role must be one of: admin, staff, client.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: existingUserRow, error: existingUserError } = await adminClient
    .from("users")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingUserError) throw existingUserError;

  let authUser = await findAuthUserByEmail(adminClient, email);

  if (existingUserRow && authUser && existingUserRow.id !== authUser.id) {
    throw new Error(
      `Conflict: public.users has ${email} as ${existingUserRow.id}, but auth.users has ${authUser.id}. Resolve the duplicate before bootstrapping.`,
    );
  }

  if (!authUser) {
    const createPayload = {
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    };

    if (existingUserRow) {
      createPayload.id = existingUserRow.id;
    }

    const { data, error } = await adminClient.auth.admin.createUser(createPayload);
    if (error || !data.user) throw error ?? new Error("Supabase did not return an auth user.");
    authUser = data.user;
  } else {
    const { data, error } = await adminClient.auth.admin.updateUserById(authUser.id, {
      password,
      user_metadata: {
        ...(authUser.user_metadata ?? {}),
        name,
        role,
      },
    });

    if (error || !data.user) throw error ?? new Error("Supabase did not return the updated auth user.");
    authUser = data.user;
  }

  const { error: upsertError } = await adminClient.from("users").upsert(
    {
      id: authUser.id,
      email,
      name,
      role,
      deleted_at: null,
      deleted_by: null,
    },
    { onConflict: "id" },
  );

  if (upsertError) throw upsertError;

  console.log("Admin account ready.");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role: ${role}`);
  console.log("Login URL: http://127.0.0.1:3000/admin/login");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

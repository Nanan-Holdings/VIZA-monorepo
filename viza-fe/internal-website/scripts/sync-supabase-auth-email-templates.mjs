import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const supabaseDir = path.join(root, "supabase");
const configPath = path.join(supabaseDir, "config.toml");

const templateTypes = [
  "confirmation",
  "magic_link",
  "recovery",
  "invite",
  "email_change",
  "reauthentication",
];
const dryRun = process.argv.includes("--dry-run");

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Set it before running sync:auth-emails.`);
  }
  return value;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readTemplateConfig(configToml, type) {
  const sectionPattern = new RegExp(
    `\\[auth\\.email\\.template\\.${escapeRegex(type)}\\]([\\s\\S]*?)(?=\\n\\[|$)`
  );
  const sectionMatch = configToml.match(sectionPattern);
  if (!sectionMatch) {
    throw new Error(`Missing [auth.email.template.${type}] in supabase/config.toml`);
  }

  const section = sectionMatch[1];
  const subjectMatch =
    section.match(/subject\s*=\s*'([\s\S]*?)'/) ??
    section.match(/subject\s*=\s*"([\s\S]*?)"/);
  const contentPathMatch =
    section.match(/content_path\s*=\s*"([^"]+)"/) ??
    section.match(/content_path\s*=\s*'([^']+)'/);

  if (!subjectMatch || !contentPathMatch) {
    throw new Error(`Template ${type} must define subject and content_path.`);
  }

  return {
    subject: subjectMatch[1],
    contentPath: contentPathMatch[1],
  };
}

const configToml = await fs.readFile(configPath, "utf8");

const payload = {};
for (const type of templateTypes) {
  const { subject, contentPath } = readTemplateConfig(configToml, type);
  const relativeTemplatePath = contentPath.replace(/^\.\/supabase\//, "");
  const fullTemplatePath = path.resolve(supabaseDir, relativeTemplatePath);
  const content = await fs.readFile(fullTemplatePath, "utf8");
  payload[`mailer_subjects_${type}`] = subject;
  payload[`mailer_templates_${type}_content`] = content;
}

if (dryRun) {
  console.log(`Prepared ${Object.keys(payload).length} Supabase auth email template fields.`);
  console.log(Object.keys(payload).sort().join("\n"));
  process.exit(0);
}

const accessToken = getRequiredEnv("SUPABASE_ACCESS_TOKEN");
const projectRef = getRequiredEnv("SUPABASE_PROJECT_REF");

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const details = await response.text();
  throw new Error(`Supabase auth email template sync failed (${response.status}): ${details}`);
}

console.log(`Synced ${templateTypes.length} Supabase auth email templates to ${projectRef}.`);

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SENSITIVE_PATTERNS = [
  "SERVICE_ROLE",
  "AUTH_SECRET",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "TWOCAPTCHA_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "AIRWALLEX_API_KEY",
  "AIRWALLEX_WEBHOOK_SECRET",
  "ALIPAY_PRIVATE_KEY",
  "GOOGLE_TRANSLATE_API_KEY",
  "DATABASE_URL",
  "POSTGRES_URL",
  "REDIS_URL",
  "BLOB_READ_WRITE_TOKEN",
  "IMAP_PASSWORD",
  "SUBMISSION_RESULT_SECRET_KEY",
];

const SKIP_DIRS = new Set([".git", ".next", ".turbo", "node_modules"]);

type EnvReport = {
  relativePath: string;
  hasBom: boolean;
  variables: string[];
};

function isDirectRun(): boolean {
  const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return scriptPath === fileURLToPath(import.meta.url);
}

function walkEnvFiles(dir: string, root: string, files: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walkEnvFiles(path.join(dir, entry.name), root, files);
      }
      continue;
    }

    if (!entry.isFile() || !entry.name.startsWith(".env")) {
      continue;
    }

    files.push(path.join(dir, entry.name));
  }
}

function readEnvNames(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf8");
  const names: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    names.push(trimmed.slice(0, idx).trim());
  }
  return names;
}

function hasBom(filePath: string): boolean {
  const bytes = fs.readFileSync(filePath);
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  );
}

function removeBom(filePath: string): void {
  const bytes = fs.readFileSync(filePath);
  if (!hasBom(filePath)) return;
  fs.writeFileSync(filePath, bytes.subarray(3));
}

function isFrontendEnv(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  return normalized.startsWith("viza-fe/internal-website/.env");
}

function isSensitiveName(name: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => name.includes(pattern));
}

function isUnsafePublicName(name: string): boolean {
  return (
    name.startsWith("NEXT_PUBLIC_") &&
    /(SECRET|SERVICE_ROLE|PRIVATE|DATABASE_URL|OPENAI|AIRWALLEX_API|ALIPAY_PRIVATE|GOOGLE_TRANSLATE|SUBMISSION_RESULT)/.test(
      name
    )
  );
}

export function main(options: { rootDir?: string; fixBom?: boolean } = {}): void {
  const rootDir = path.resolve(
    options.rootDir ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
  );
  const fixBom = options.fixBom ?? process.argv.includes("--fix-bom");
  const envFiles: string[] = [];
  walkEnvFiles(rootDir, rootDir, envFiles);

  const reports: EnvReport[] = envFiles
    .sort((a, b) => a.localeCompare(b))
    .map((filePath) => {
      const report = {
        relativePath: path.relative(rootDir, filePath),
        hasBom: hasBom(filePath),
        variables: readEnvNames(filePath),
      };
      if (fixBom && report.hasBom) {
        removeBom(filePath);
      }
      return report;
    });

  const bomReports = reports.filter((report) => report.hasBom);
  const frontendSecretNames = reports.flatMap((report) =>
    isFrontendEnv(report.relativePath)
      ? report.variables
          .filter(isSensitiveName)
          .map((name) => `${report.relativePath} :: ${name}`)
      : []
  );
  const unsafePublicNames = reports.flatMap((report) =>
    isFrontendEnv(report.relativePath)
      ? report.variables
          .filter(isUnsafePublicName)
          .map((name) => `${report.relativePath} :: ${name}`)
      : []
  );

  console.log("VIZA env doctor");
  console.log(`Repo: ${rootDir}`);
  console.log("");

  for (const report of reports) {
    console.log(report.relativePath);
    console.log(`  BOM: ${report.hasBom}`);
    console.log(
      `  Variables: ${report.variables.length > 0 ? report.variables.join(", ") : "(none)"}`
    );
  }

  console.log("");
  console.log("Summary");
  if (bomReports.length === 0) {
    console.log("- BOM: none found");
  } else if (fixBom) {
    console.log("- BOM removed from:");
    for (const report of bomReports) console.log(`  - ${report.relativePath}`);
  } else {
    console.log("- BOM found in:");
    for (const report of bomReports) console.log(`  - ${report.relativePath}`);
    console.log("  Re-run with --fix-bom to remove UTF-8 BOMs.");
  }

  if (frontendSecretNames.length === 0) {
    console.log("- Frontend backend-secret variable names: none found");
  } else {
    console.log("- Frontend backend-secret variable names found:");
    for (const entry of frontendSecretNames) console.log(`  - ${entry}`);
    console.log(
      "  Move these to backend env files and rotate any value that was committed or shared."
    );
  }

  if (unsafePublicNames.length === 0) {
    console.log("- Unsafe NEXT_PUBLIC_ sensitive names: none found");
  } else {
    console.log("- Unsafe NEXT_PUBLIC_ sensitive names found:");
    for (const entry of unsafePublicNames) console.log(`  - ${entry}`);
    console.log(
      "  NEXT_PUBLIC_ values are browser-visible. Rename and move sensitive values server-side."
    );
  }

  console.log("");
  console.log("No secret values were printed.");
}

if (isDirectRun()) {
  main();
}

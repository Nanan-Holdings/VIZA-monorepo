import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DRIZZLE_MIGRATION_ROOT = "viza-be/agent-backend/drizzle";
export const SUPABASE_MIGRATION_ROOT = "viza-fe/internal-website/supabase/migrations";
export const DEFAULT_GOVERNANCE_MANIFEST =
  "scripts/database-architecture/migration-governance.json";

function normalizePath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//u, "");
}

function isMigrationPath(filePath) {
  const normalized = normalizePath(filePath);
  return normalized.endsWith(".sql") && (
    normalized.startsWith(`${DRIZZLE_MIGRATION_ROOT}/`) ||
    normalized.startsWith(`${SUPABASE_MIGRATION_ROOT}/`)
  );
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertHistoricalManifestImmutable(manifest, baseManifest) {
  if (!baseManifest) return;
  if (
    stableJson(manifest.historical_duplicate_drizzle_prefixes) !==
    stableJson(baseManifest.historical_duplicate_drizzle_prefixes)
  ) {
    throw new Error("Historical duplicate allowlist is immutable");
  }
  if (baseManifest.historical_duplicate_supabase_versions !== undefined &&
      stableJson(manifest.historical_duplicate_supabase_versions) !==
      stableJson(baseManifest.historical_duplicate_supabase_versions)) {
    throw new Error("Historical Supabase version allowlist is immutable");
  }

  for (const key of ["migration_pairs", "no_mirror"]) {
    const current = new Set((manifest[key] ?? []).map(stableJson));
    const missing = (baseManifest[key] ?? []).find((entry) => !current.has(stableJson(entry)));
    if (missing) {
      throw new Error(`Previously approved ${key} entries are immutable`);
    }
  }
}

function assertExactHistoricalSupabaseVersions(currentFiles, manifest) {
  const groups = new Map();
  for (const filePath of currentFiles) {
    if (!filePath.startsWith(`${SUPABASE_MIGRATION_ROOT}/`)) continue;
    const fileName = path.posix.basename(filePath);
    const match = /^(\d+)_/u.exec(fileName);
    if (!match) throw new Error(`Invalid Supabase migration filename: ${fileName}`);
    const names = groups.get(match[1]) ?? [];
    names.push(fileName);
    groups.set(match[1], names);
  }
  const allowlist = manifest.historical_duplicate_supabase_versions ?? {};
  for (const [version, names] of groups) {
    if (names.length <= 1) continue;
    const actual = [...names].sort();
    const expected = Array.isArray(allowlist[version]) ? [...allowlist[version]].sort() : [];
    if (stableJson(actual) !== stableJson(expected)) {
      throw new Error(`Duplicate Supabase migration version ${version}`);
    }
  }
  for (const [version, expectedNames] of Object.entries(allowlist)) {
    const actual = [...(groups.get(version) ?? [])].sort();
    if (stableJson(actual) !== stableJson([...expectedNames].sort())) {
      throw new Error(`Historical Supabase version ${version} no longer matches its allowlist`);
    }
  }
  return Object.keys(allowlist).length;
}

function assertExactHistoricalDuplicates(currentFiles, manifest) {
  const drizzleNames = currentFiles
    .map(normalizePath)
    .filter((filePath) => filePath.startsWith(`${DRIZZLE_MIGRATION_ROOT}/`))
    .map((filePath) => path.posix.basename(filePath));
  const groups = new Map();
  for (const fileName of drizzleNames) {
    const match = /^(\d{4})_/u.exec(fileName);
    if (!match) throw new Error(`Invalid Drizzle migration filename: ${fileName}`);
    const names = groups.get(match[1]) ?? [];
    names.push(fileName);
    groups.set(match[1], names);
  }

  const allowlist = manifest.historical_duplicate_drizzle_prefixes ?? {};
  for (const [prefix, names] of groups) {
    if (names.length <= 1) continue;
    const actual = [...names].sort();
    const expected = Array.isArray(allowlist[prefix]) ? [...allowlist[prefix]].sort() : [];
    if (stableJson(actual) !== stableJson(expected)) {
      throw new Error(`Unexpected duplicate Drizzle migration prefix ${prefix}`);
    }
  }
  for (const [prefix, expectedNames] of Object.entries(allowlist)) {
    const actual = [...(groups.get(prefix) ?? [])].sort();
    if (stableJson(actual) !== stableJson([...expectedNames].sort())) {
      throw new Error(`Historical duplicate Drizzle prefix ${prefix} no longer matches its allowlist`);
    }
  }
  return Object.keys(allowlist).length;
}

function escapedRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function maskSqlLiteralsAndComments(sql) {
  let result = "";
  for (let index = 0; index < sql.length;) {
    if (sql.startsWith("--", index)) {
      const end = sql.indexOf("\n", index + 2);
      const stop = end === -1 ? sql.length : end;
      result += " ".repeat(stop - index);
      index = stop;
      continue;
    }
    if (sql.startsWith("/*", index)) {
      const end = sql.indexOf("*/", index + 2);
      const stop = end === -1 ? sql.length : end + 2;
      result += " ".repeat(stop - index);
      index = stop;
      continue;
    }
    if (sql[index] === "'") {
      if (sql[index + 1] === "'") {
        result += "''";
        index += 2;
        continue;
      }
      let stop = index + 1;
      while (stop < sql.length) {
        if (sql[stop] === "'" && sql[stop + 1] === "'") {
          stop += 2;
        } else if (sql[stop] === "'") {
          stop += 1;
          break;
        } else {
          stop += 1;
        }
      }
      result += " ".repeat(stop - index);
      index = stop;
      continue;
    }
    if (sql[index] === "$") {
      const delimiter = /^\$[a-z_][a-z0-9_]*\$|^\$\$/iu.exec(sql.slice(index))?.[0];
      if (delimiter) {
        const end = sql.indexOf(delimiter, index + delimiter.length);
        const stop = end === -1 ? sql.length : end + delimiter.length;
        result += " ".repeat(stop - index);
        index = stop;
        continue;
      }
    }
    result += sql[index];
    index += 1;
  }
  return result;
}

const SQL_IDENTIFIER = '(?:"(?:[^"]|"")*"|[a-z_][a-z0-9_$]*)';

function decodedIdentifier(value) {
  return value.startsWith('"') ? value.slice(1, -1).replaceAll('""', '"') : value;
}

function identifierPattern(value) {
  return value.startsWith('"')
    ? escapedRegExp(value)
    : `(?:${escapedRegExp(value)}|"${escapedRegExp(value)}")`;
}

function assertSecureNewPublicObjects(sql, filePath) {
  const structuralSql = maskSqlLiteralsAndComments(sql);
  const tablePattern = new RegExp(
    `\\bCREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?` +
    `(${SQL_IDENTIFIER})\\s*\\.\\s*(${SQL_IDENTIFIER})`,
    "giu",
  );
  for (const match of structuralSql.matchAll(tablePattern)) {
    const schema = decodedIdentifier(match[1]);
    const table = decodedIdentifier(match[2]);
    if (schema.toLowerCase() !== "public") continue;
    const qualified = `${identifierPattern(match[1])}\\s*\\.\\s*${identifierPattern(match[2])}`;
    const rlsPattern = new RegExp(
      `\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${qualified}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY\\b`,
      "iu",
    );
    if (!rlsPattern.test(structuralSql)) {
      throw new Error(`${filePath}: public.${table} must enable RLS in the same migration`);
    }
    const aclPattern = new RegExp(
      `\\b(?:GRANT|REVOKE)\\b[\\s\\S]*?\\bON\\s+(?:TABLE\\s+)?${qualified}\\b`,
      "iu",
    );
    if (!aclPattern.test(structuralSql)) {
      throw new Error(`${filePath}: public.${table} must declare an explicit ACL in the same migration`);
    }
  }

  const routinePattern = new RegExp(
    `\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:FUNCTION|PROCEDURE)\\s+` +
    `${SQL_IDENTIFIER}\\s*\\.\\s*${SQL_IDENTIFIER}\\s*\\(`,
    "giu",
  );
  const functionStarts = [...structuralSql.matchAll(routinePattern)];
  for (let index = 0; index < functionStarts.length; index += 1) {
    const start = functionStarts[index].index;
    const end = functionStarts[index + 1]?.index ?? structuralSql.length;
    const definition = structuralSql.slice(start, end);
    if (/\bSECURITY\s+DEFINER\b/iu.test(definition) &&
        !/\bSET\s+search_path\s*(?:=|TO)\s*''\s*(?:\r?\n|AS\b|LANGUAGE\b)/iu.test(
          definition,
        )) {
      throw new Error(`${filePath}: SECURITY DEFINER functions require an empty search_path`);
    }
  }

  const viewPattern = new RegExp(
    `\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?VIEW\\s+` +
    `(${SQL_IDENTIFIER})\\s*\\.\\s*(${SQL_IDENTIFIER})`,
    "giu",
  );
  for (const match of structuralSql.matchAll(viewPattern)) {
    const definition = structuralSql.slice(match.index, structuralSql.indexOf(";", match.index) === -1
      ? structuralSql.length
      : structuralSql.indexOf(";", match.index) + 1);
    if (!/\bWITH\s*\([^)]*\bsecurity_invoker\s*=\s*true\b[^)]*\)/iu.test(definition)) {
      throw new Error(
        `${filePath}: ${decodedIdentifier(match[1])}.${decodedIdentifier(match[2])} views require security_invoker = true`,
      );
    }
  }
}

function assertPinnedEntry(entry, currentFileSet, readFile, hash) {
  if (!isMigrationPath(entry.path)) {
    throw new Error(`Invalid governed migration path: ${entry.path}`);
  }
  if (!currentFileSet.has(entry.path)) {
    throw new Error(`Governed migration is missing: ${entry.path}`);
  }
  const actualHash = hash(readFile(entry.path));
  if (actualHash !== entry.sha256) {
    throw new Error(`Governed migration hash mismatch: ${entry.path}`);
  }
}

export function validateMigrationGovernance({
  manifest,
  baseManifest,
  currentFiles,
  changes,
  readFile,
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex"),
} = {}) {
  if (!manifest || manifest.schema_version !== 1) {
    throw new Error("Migration governance manifest schema_version must be 1");
  }
  if (!Array.isArray(currentFiles) || !Array.isArray(changes) || typeof readFile !== "function") {
    throw new Error("Migration governance inputs are incomplete");
  }
  assertHistoricalManifestImmutable(manifest, baseManifest);

  const normalizedFiles = currentFiles.map(normalizePath).filter(isMigrationPath);
  const currentFileSet = new Set(normalizedFiles);
  const historicalDuplicateGroups = assertExactHistoricalDuplicates(normalizedFiles, manifest);
  const historicalSupabaseDuplicateVersions = assertExactHistoricalSupabaseVersions(
    normalizedFiles,
    manifest,
  );

  const migrationChanges = changes
    .map((change) => ({ ...change, path: normalizePath(change.path) }))
    .filter((change) => isMigrationPath(change.path));
  const immutableChange = migrationChanges.find((change) => change.status !== "A");
  if (immutableChange) {
    throw new Error(
      `Existing migration files are immutable (${immutableChange.status} ${immutableChange.path})`,
    );
  }
  const added = migrationChanges.filter((change) => change.status === "A").map((change) => change.path);
  for (const filePath of added) {
    if (filePath.startsWith(`${SUPABASE_MIGRATION_ROOT}/`) &&
        !/^\d{14}_[a-zA-Z0-9][a-zA-Z0-9_.-]*\.sql$/u.test(path.posix.basename(filePath))) {
      throw new Error(`New Supabase migration requires a unique 14-digit timestamp: ${filePath}`);
    }
  }
  const classifications = new Map(added.map((filePath) => [filePath, 0]));

  const pairs = manifest.migration_pairs ?? [];
  for (const pair of pairs) {
    const drizzle = normalizePath(pair.drizzle);
    const supabase = normalizePath(pair.supabase);
    if (!drizzle.startsWith(`${DRIZZLE_MIGRATION_ROOT}/`) ||
        !supabase.startsWith(`${SUPABASE_MIGRATION_ROOT}/`)) {
      throw new Error("Migration pairs must map one Drizzle file to one Supabase mirror");
    }
    assertPinnedEntry({ path: drizzle, sha256: pair.sha256 }, currentFileSet, readFile, hash);
    assertPinnedEntry({ path: supabase, sha256: pair.sha256 }, currentFileSet, readFile, hash);
    if (classifications.has(drizzle)) classifications.set(drizzle, classifications.get(drizzle) + 1);
    if (classifications.has(supabase)) classifications.set(supabase, classifications.get(supabase) + 1);
    if (classifications.has(drizzle) !== classifications.has(supabase)) {
      throw new Error("A new migration mirror pair must add both files together");
    }
  }

  const noMirror = manifest.no_mirror ?? [];
  for (const entry of noMirror) {
    const filePath = normalizePath(entry.path);
    if (typeof entry.reason !== "string" || entry.reason.trim().length < 8) {
      throw new Error(`No-mirror migration requires a specific reason: ${filePath}`);
    }
    assertPinnedEntry({ ...entry, path: filePath }, currentFileSet, readFile, hash);
    if (classifications.has(filePath)) {
      classifications.set(filePath, classifications.get(filePath) + 1);
    }
  }

  for (const [filePath, count] of classifications) {
    if (count !== 1) {
      throw new Error(`New migration ${filePath} is not classified exactly once`);
    }
    assertSecureNewPublicObjects(Buffer.from(readFile(filePath)).toString("utf8"), filePath);
  }

  return {
    historical_duplicate_groups: historicalDuplicateGroups,
    historical_supabase_duplicate_versions: historicalSupabaseDuplicateVersions,
    added_migrations: added.length,
    migration_pairs: pairs.length,
    no_mirror: noMirror.length,
  };
}

function runGit(rootDir, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(`git ${args[0]} failed while checking migration governance`);
  }
  return result;
}

function currentMigrationFiles(rootDir) {
  return [DRIZZLE_MIGRATION_ROOT, SUPABASE_MIGRATION_ROOT].flatMap((directory) =>
    readdirSync(path.resolve(rootDir, directory), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => `${directory}/${entry.name}`));
}

function gitMigrationChanges(rootDir, baseRef) {
  const result = runGit(rootDir, [
    "diff", "--name-status", "--find-renames", `${baseRef}...HEAD`, "--",
    DRIZZLE_MIGRATION_ROOT, SUPABASE_MIGRATION_ROOT,
  ]);
  return result.stdout.split(/\r?\n/u).filter(Boolean).flatMap((line) => {
    const parts = line.split("\t");
    const status = parts[0][0];
    if (status === "R" || status === "C") {
      return [
        { status, path: parts[1] },
        { status, path: parts[2] },
      ];
    }
    return [{ status, path: parts[1] }];
  });
}

function readBaseManifest(rootDir, baseRef, manifestPath) {
  const result = runGit(rootDir, ["show", `${baseRef}:${manifestPath}`], { allowFailure: true });
  if (result.status !== 0) return undefined;
  return JSON.parse(result.stdout);
}

export function runMigrationGovernanceCli({
  rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  argv = process.argv.slice(2),
} = {}) {
  const baseIndex = argv.indexOf("--base-ref");
  const baseRef = baseIndex === -1 ? process.env.DB_MIGRATION_GOVERNANCE_BASE_REF : argv[baseIndex + 1];
  if (!baseRef) throw new Error("--base-ref is required for migration immutability checks");
  const manifestPath = DEFAULT_GOVERNANCE_MANIFEST;
  const manifest = JSON.parse(readFileSync(path.resolve(rootDir, manifestPath), "utf8"));
  return validateMigrationGovernance({
    manifest,
    baseManifest: readBaseManifest(rootDir, baseRef, manifestPath),
    currentFiles: currentMigrationFiles(rootDir),
    changes: gitMigrationChanges(rootDir, baseRef),
    readFile: (filePath) => readFileSync(path.resolve(rootDir, filePath)),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(runMigrationGovernanceCli(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

#!/usr/bin/env node
/**
 * One-off migration: upload public/travel/** to the public Supabase Storage
 * bucket `travel-images`, preserving relative paths (cities/x.jpg, ...).
 *
 * The app keeps requesting /travel/<path>; an afterFiles rewrite in
 * next.config.ts proxies those to the bucket, so no URL stored in code or
 * DB changes. Re-runnable (upsert). Usage:
 *
 *   node scripts/upload-travel-images-to-storage.mjs [--env-file .env.local]
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const BUCKET = "travel-images";
const SRC_DIR = path.join(process.cwd(), "public", "travel");
const CONCURRENCY = 10;

const envFileArg = process.argv.indexOf("--env-file");
const envFile = envFileArg > -1 ? process.argv[envFileArg + 1] : ".env.local";

async function loadEnv(file) {
  const text = await readFile(file, "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r]*)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const CONTENT_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".avif": "image/avif" };

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (CONTENT_TYPES[path.extname(entry.name).toLowerCase()]) out.push(full);
  }
  return out;
}

const env = await loadEnv(envFile);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(`Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in ${envFile}`);
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Ensure the bucket exists and is public.
const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) throw listErr;
if (!buckets.some((b) => b.name === BUCKET)) {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error) throw error;
  console.log(`Created public bucket ${BUCKET}`);
}

const files = await walk(SRC_DIR);
console.log(`Uploading ${files.length} files from ${SRC_DIR} ...`);
let done = 0;
const failures = [];

async function uploadOne(file) {
  const rel = path.relative(SRC_DIR, file).split(path.sep).join("/");
  const body = await readFile(file);
  const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()];
  const { error } = await supabase.storage.from(BUCKET).upload(rel, body, {
    contentType,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) failures.push(`${rel}: ${error.message}`);
  done += 1;
  if (done % 100 === 0) console.log(`  ${done}/${files.length}`);
}

const queue = [...files];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await uploadOne(queue.pop());
  }),
);

if (failures.length) {
  console.error(`FAILED ${failures.length}:`);
  for (const f of failures.slice(0, 20)) console.error("  " + f);
  process.exit(1);
}
console.log(`Done. ${files.length} files in bucket ${BUCKET}.`);

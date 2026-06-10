// One-off: download each country's hero photo to public/assets/heroes/<slug>.jpg
// so the marketing site never hotlinks Unsplash at runtime (hotlinks were
// breaking / rate-limited in production). Run once and commit the images:
//
//   node scripts/fetch-hero-images.mjs
//
// Egypt already ships a local asset (public/assets/egypt-giza.avif); it is
// copied into the heroes folder for a consistent /assets/heroes/<slug>.* path.
// Re-run only when curating a new/replacement image (update HEROES below).

import { mkdir, writeFile, copyFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "public/assets/heroes");

// slug -> Unsplash photo id (mirrors lib/countries.ts). `local` copies an
// existing committed asset instead of downloading.
const HEROES = {
  indonesia: "photo-1537996194471-e657df975ab4",
  egypt: { local: "public/assets/egypt-giza.avif", ext: "avif" },
  australia: "photo-1506973035872-a4ec16b8e8d9",
  "saudi-arabia": "photo-1586724237569-f3d0c1dee8c6",
  "united-kingdom": "photo-1486299267070-83823f5448dd",
  vietnam: "photo-1528127269322-539801943592",
  malaysia: "photo-1596422846543-75c6fc197f07",
  japan: "photo-1492571350019-22de08371fd3",
  "united-states": "photo-1485871981521-5b1fd3805eee",
  canada: "photo-1503614472-8c93d56e92ce",
  turkiye: "photo-1527838832700-5059252407fa",
  thailand: "photo-1528181304800-259b08848526",
  "united-arab-emirates": "photo-1512453979798-5ea266f8880c",
  france: "photo-1431274172761-fca41d930114",
  italy: "photo-1531572753322-ad063cecc140",
  india: "photo-1524492412937-b28074a5d7da",
};

const unsplashUrl = (id) =>
  `https://images.unsplash.com/${id}?w=1600&auto=format&fit=crop&q=75`;

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const results = [];

  for (const [slug, spec] of Object.entries(HEROES)) {
    try {
      if (typeof spec === "object" && spec.local) {
        const src = resolve(ROOT, spec.local);
        const dest = resolve(OUT_DIR, `${slug}.${spec.ext}`);
        if (!(await exists(src))) throw new Error(`local source missing: ${spec.local}`);
        await copyFile(src, dest);
        results.push(`✓ ${slug} (copied ${spec.local})`);
        continue;
      }

      const res = await fetch(unsplashUrl(spec));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(resolve(OUT_DIR, `${slug}.jpg`), buf);
      results.push(`✓ ${slug} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      results.push(`✗ ${slug} — ${err.message}`);
    }
  }

  console.log(results.join("\n"));
  const failed = results.filter((r) => r.startsWith("✗"));
  if (failed.length) {
    console.error(`\n${failed.length} image(s) failed — replace the dead Unsplash id in HEROES.`);
    process.exit(1);
  }
}

main();

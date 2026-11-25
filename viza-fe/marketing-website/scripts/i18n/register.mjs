// Lets plain Node (type stripping) import the site's TypeScript content files: extensionless relative imports,
// "@/..." aliases and index.ts folders. Use:  node --import ./scripts/i18n/register.mjs <script>
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const EXTS = [".ts", ".tsx", "/index.ts"];

function tryFile(path) {
  if (existsSync(path) && statSync(path).isFile()) return path;
  for (const ext of EXTS) if (existsSync(path + ext)) return path + ext;
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = null;
    if (specifier.startsWith("@/")) target = tryFile(ROOT + specifier.slice(2));
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      target = tryFile(fileURLToPath(new URL(specifier, context.parentURL)));
    }
    return nextResolve(target ? pathToFileURL(target).href : specifier, context);
  },
});

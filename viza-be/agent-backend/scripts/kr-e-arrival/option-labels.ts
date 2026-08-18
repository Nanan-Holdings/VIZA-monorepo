import { readFileSync } from "node:fs";
import type { KrEArrivalOfficialOption, KrEArrivalOptionListKind } from "./official-options";

interface TranslationSnapshot {
  sex?: Record<string, string>;
  transport?: Record<string, string>;
  purpose?: Record<string, string>;
  occupation?: Record<string, string>;
}

function loadTranslations(): TranslationSnapshot {
  try {
    return JSON.parse(
      readFileSync(new URL("./option-translations.zh.json", import.meta.url), "utf8"),
    ) as TranslationSnapshot;
  } catch {
    return {};
  }
}

const TRANSLATIONS = loadTranslations();

export function krEArrivalOptionLabelZh(
  kind: KrEArrivalOptionListKind,
  option: Pick<KrEArrivalOfficialOption, "value" | "label_zh" | "label_en">,
): string {
  return TRANSLATIONS[kind]?.[option.value] ?? option.label_zh ?? option.label_en;
}

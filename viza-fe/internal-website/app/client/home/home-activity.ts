type HomeDocumentLabelTranslator = {
  (key: string, values?: Record<string, string | number>): string;
  has?: (key: string) => boolean;
};

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function humanizeDocumentType(documentType: string | null | undefined) {
  const normalized = documentType?.trim();
  return normalized ? toTitleCase(normalized) : "Document";
}

export function resolveHomeDocumentLabel(
  t: HomeDocumentLabelTranslator,
  documentType: string,
  warn: (message: string) => void = console.warn,
) {
  const key = `docLabels.${documentType}`;
  try {
    if (typeof t.has === "function" && !t.has(key)) {
      throw new Error(`Missing home document label: ${key}`);
    }
    return t(key);
  } catch {
    warn(`[home] Missing document label for ${key}`);
    return humanizeDocumentType(documentType);
  }
}

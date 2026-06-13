import type { Page } from "@playwright/test";

export interface VietnamPortalValidationError {
  label: string;
  message: string;
  domId?: string;
}

export function dedupeVietnamValidationErrors(
  errors: VietnamPortalValidationError[],
): VietnamPortalValidationError[] {
  const seen = new Set<string>();
  const deduped: VietnamPortalValidationError[] = [];
  for (const error of errors) {
    const key = `${error.domId ?? ""}|${error.label}|${error.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(error);
  }
  return deduped;
}

export async function readVietnamValidationErrors(page: Page): Promise<VietnamPortalValidationError[]> {
  const errors = await page
    .evaluate(() => {
      const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
      const items = Array.from(document.querySelectorAll<HTMLElement>(".ant-form-item-has-error, .ant-form-item"));
      return items
        .map((item) => {
          const message = normalize(
            item.querySelector<HTMLElement>(".ant-form-item-explain-error, [role='alert']")?.innerText,
          );
          if (!message) return null;
          const label = normalize(item.querySelector<HTMLElement>("label")?.innerText);
          const control = item.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
            "input[id], textarea[id], select[id]",
          );
          return {
            label,
            message,
            domId: control?.id || undefined,
          };
        })
        .filter(Boolean);
    })
    .catch(() => []);

  return dedupeVietnamValidationErrors(errors as VietnamPortalValidationError[]);
}

export function maskSensitiveText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const visibleTail = normalized.replace(/\s+/g, "").slice(-4);
  return visibleTail ? `•••• ${visibleTail}` : "••••";
}

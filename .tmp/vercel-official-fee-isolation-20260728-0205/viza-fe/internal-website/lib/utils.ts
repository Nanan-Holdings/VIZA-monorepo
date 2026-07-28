import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Normalizes text entered into a client-side search control. */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

/**
 * Returns whether a query occurs in any localized label, code, or alias.
 * Callers should supply every display-language variant as a candidate.
 */
export function matchesSearchText(searchQuery: string, candidates: readonly string[]): boolean {
  const normalizedQuery = normalizeSearchText(searchQuery);
  if (!normalizedQuery) return true;

  return candidates.some((candidate) => normalizeSearchText(candidate).includes(normalizedQuery));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

/**
 * Calculate age in years from date of birth
 */
/**
 * Format a numeric display value: max 5 decimal places, strip trailing zeros.
 * Integers are returned as-is. Non-finite or NaN inputs pass through as strings.
 */
export function formatDisplayValue(v: number | string): string {
  const num = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(num)) return String(v);
  if (Number.isInteger(num)) return num.toString();
  const formatted = num.toFixed(5).replace(/\.?0+$/, '');
  return formatted;
}

export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

/**
 * Client instrumentation: runs after the document loads, before hydration.
 * Boots PostHog + Microsoft Clarity. See lib/observability.ts.
 */
import { initObservability } from "@/lib/observability";

try {
  initObservability();
} catch {
  // Instrumentation must never break app startup.
}

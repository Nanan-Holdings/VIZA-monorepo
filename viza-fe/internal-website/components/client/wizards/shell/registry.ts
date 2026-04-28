/**
 * Resolve a `visa_packages.visa_type` value to its wizard config.
 *
 * Returns `null` for legacy / unconfigured packages — callers should
 * route those users straight to the long form at /application/long-form.
 */
import type { WizardConfig } from "./types";
import { usConfig } from "../us/config";
import { ukConfig } from "../uk/config";
import { schengenConfig } from "../schengen/config";
import { vnConfig } from "../vn/config";
import { auConfig } from "../au/config";
import { egConfig } from "../eg/config";

const REGISTRY: Record<string, WizardConfig<unknown>> = {
  [usConfig.visaType]: usConfig as WizardConfig<unknown>,
  [ukConfig.visaType]: ukConfig as WizardConfig<unknown>,
  [schengenConfig.visaType]: schengenConfig as WizardConfig<unknown>,
  [vnConfig.visaType]: vnConfig as WizardConfig<unknown>,
  [auConfig.visaType]: auConfig as WizardConfig<unknown>,
  [egConfig.visaType]: egConfig as WizardConfig<unknown>,
};

export function pickWizardConfig(visaType: string | null | undefined): WizardConfig<unknown> | null {
  if (!visaType) return null;
  return REGISTRY[visaType] ?? null;
}

export function hasWizardConfig(visaType: string | null | undefined): boolean {
  return !!visaType && visaType in REGISTRY;
}

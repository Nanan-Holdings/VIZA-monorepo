/**
 * Resolve a `visa_packages.visa_type` value to its wizard config + the
 * launch-country wizard coverage contract (POR-001).
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
import { idConfig } from "../id/config";
import { saConfig } from "../sa/config";
import { myConfig } from "../my/config";
import { thConfig } from "../th/config";
import { aeConfig } from "../ae/config";
import { caConfig } from "../ca/config";
import { trConfig } from "../tr/config";
import { inConfig } from "../in/config";
import { jpConfig } from "../jp/config";

const REGISTRY: Record<string, WizardConfig<unknown>> = {
  [usConfig.visaType]: usConfig as WizardConfig<unknown>,
  [ukConfig.visaType]: ukConfig as WizardConfig<unknown>,
  [schengenConfig.visaType]: schengenConfig as WizardConfig<unknown>,
  [vnConfig.visaType]: vnConfig as WizardConfig<unknown>,
  [auConfig.visaType]: auConfig as WizardConfig<unknown>,
  [egConfig.visaType]: egConfig as WizardConfig<unknown>,
  [idConfig.visaType]: idConfig as WizardConfig<unknown>,
  [saConfig.visaType]: saConfig as WizardConfig<unknown>,
  [myConfig.visaType]: myConfig as WizardConfig<unknown>,
  [thConfig.visaType]: thConfig as WizardConfig<unknown>,
  [aeConfig.visaType]: aeConfig as WizardConfig<unknown>,
  [caConfig.visaType]: caConfig as WizardConfig<unknown>,
  [trConfig.visaType]: trConfig as WizardConfig<unknown>,
  [inConfig.visaType]: inConfig as WizardConfig<unknown>,
  [jpConfig.visaType]: jpConfig as WizardConfig<unknown>,
};

export function pickWizardConfig(visaType: string | null | undefined): WizardConfig<unknown> | null {
  if (!visaType) return null;
  return REGISTRY[visaType] ?? null;
}

export function hasWizardConfig(visaType: string | null | undefined): boolean {
  return !!visaType && visaType in REGISTRY;
}

/* ----------------------------- POR-001 coverage contract ----------------------------- */

/**
 * The wizard visa_type each of the 16 launch countries must resolve to.
 * `comingSoon: true` explicitly allows a launch country to ship without a
 * wizard (it falls back to the long form) without failing the guard.
 */
export interface LaunchWizardEntry {
  country: string;
  visaType: string;
  comingSoon?: boolean;
}

export const LAUNCH_WIZARD_CONTRACT: LaunchWizardEntry[] = [
  { country: "indonesia", visaType: "ID_C1_TOURIST" },
  { country: "egypt", visaType: "EG_E_VISA" },
  { country: "australia", visaType: "AU_VISITOR_600" },
  { country: "saudi_arabia", visaType: "SA_E_VISA" },
  { country: "united_kingdom", visaType: "UK_STANDARD_VISITOR" },
  { country: "vietnam", visaType: "VN_E_VISA" },
  { country: "malaysia", visaType: "MY_TOURIST_E_VISA" },
  { country: "japan", visaType: "JP_TOURIST" },
  { country: "united_states", visaType: "DS160" },
  { country: "canada", visaType: "CA_TRV" },
  { country: "turkey", visaType: "TR_E_VISA" },
  { country: "thailand", visaType: "TH_TOURIST_E_VISA" },
  { country: "united_arab_emirates", visaType: "AE_TOURIST_VISA" },
  { country: "france", visaType: "EU_SCHENGEN_C_SHORT_STAY" },
  { country: "italy", visaType: "EU_SCHENGEN_C_SHORT_STAY" },
  { country: "india", visaType: "IN_E_VISA" },
];

/** Launch countries whose wizard config is missing (excludes comingSoon). */
export function missingWizardConfigs(): LaunchWizardEntry[] {
  return LAUNCH_WIZARD_CONTRACT.filter((e) => !e.comingSoon && !hasWizardConfig(e.visaType));
}

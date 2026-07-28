import { makeStandardEvisaWizard, type StandardForm } from "../shell/standard-evisa-config";
import type { WizardConfig } from "../shell/types";

/** thailand wizard config (standard e-Visa factory). */
export const thConfig: WizardConfig<StandardForm> = makeStandardEvisaWizard({
  visaType: "TH_TOURIST_E_VISA",
  defaultCountry: "thailand",
});

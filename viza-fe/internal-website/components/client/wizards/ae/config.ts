import { makeStandardEvisaWizard, type StandardForm } from "../shell/standard-evisa-config";
import type { WizardConfig } from "../shell/types";

/** united_arab_emirates wizard config (standard e-Visa factory). */
export const aeConfig: WizardConfig<StandardForm> = makeStandardEvisaWizard({
  visaType: "AE_TOURIST_VISA",
  defaultCountry: "united_arab_emirates",
});

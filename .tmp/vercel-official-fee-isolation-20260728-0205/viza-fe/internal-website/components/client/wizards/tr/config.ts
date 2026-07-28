import { makeStandardEvisaWizard, type StandardForm } from "../shell/standard-evisa-config";
import type { WizardConfig } from "../shell/types";

/** turkey wizard config (standard e-Visa factory). */
export const trConfig: WizardConfig<StandardForm> = makeStandardEvisaWizard({
  visaType: "TR_E_VISA",
  defaultCountry: "turkey",
});

import { makeStandardEvisaWizard, type StandardForm } from "../shell/standard-evisa-config";
import type { WizardConfig } from "../shell/types";

/** saudi_arabia wizard config (standard e-Visa factory). */
export const saConfig: WizardConfig<StandardForm> = makeStandardEvisaWizard({
  visaType: "SA_E_VISA",
  defaultCountry: "saudi_arabia",
});

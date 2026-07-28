import { makeStandardEvisaWizard, type StandardForm } from "../shell/standard-evisa-config";
import type { WizardConfig } from "../shell/types";

/** malaysia wizard config (standard e-Visa factory). */
export const myConfig: WizardConfig<StandardForm> = makeStandardEvisaWizard({
  visaType: "MY_TOURIST_E_VISA",
  defaultCountry: "malaysia",
});

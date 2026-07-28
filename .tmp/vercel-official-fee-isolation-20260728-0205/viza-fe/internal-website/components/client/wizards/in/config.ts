import { makeStandardEvisaWizard, type StandardForm } from "../shell/standard-evisa-config";
import type { WizardConfig } from "../shell/types";

/** india wizard config (standard e-Visa factory). */
export const inConfig: WizardConfig<StandardForm> = makeStandardEvisaWizard({
  visaType: "IN_E_VISA",
  defaultCountry: "india",
});

import { makeStandardEvisaWizard, type StandardForm } from "../shell/standard-evisa-config";
import type { WizardConfig } from "../shell/types";

/** canada wizard config (standard e-Visa factory). */
export const caConfig: WizardConfig<StandardForm> = makeStandardEvisaWizard({
  visaType: "CA_TRV",
  defaultCountry: "canada",
});

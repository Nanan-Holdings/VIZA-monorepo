import { makeStandardEvisaWizard, type StandardForm } from "../shell/standard-evisa-config";
import type { WizardConfig } from "../shell/types";

/** japan wizard config (standard e-Visa factory). */
export const jpConfig: WizardConfig<StandardForm> = makeStandardEvisaWizard({
  visaType: "JP_TOURIST",
  defaultCountry: "japan", note: "Paper-only output (MOFA Form A); no online submit.",
});

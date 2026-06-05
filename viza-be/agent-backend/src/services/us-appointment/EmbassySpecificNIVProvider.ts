import { AssistedLiveDisabledProvider } from "./AssistedLiveDisabledProvider.js";

export class EmbassySpecificNIVProvider extends AssistedLiveDisabledProvider {
  constructor() {
    super({
      providerName: "embassy_specific_niv",
      schedulingProvider: "embassy_specific_manual",
      portal: "https://www.usembassy.gov/",
      supportedApplyingCountries: ["*"],
    });
  }
}

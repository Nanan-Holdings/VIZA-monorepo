import { AssistedLiveDisabledProvider } from "./AssistedLiveDisabledProvider.js";

export class USTravelDocsProvider extends AssistedLiveDisabledProvider {
  constructor() {
    super({
      providerName: "us_travel_docs",
      schedulingProvider: "ustraveldocs",
      portal: "https://www.ustraveldocs.com/",
      supportedApplyingCountries: ["*"],
    });
  }
}

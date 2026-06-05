import { AssistedLiveDisabledProvider } from "./AssistedLiveDisabledProvider.js";

export class USVisaSchedulingProvider extends AssistedLiveDisabledProvider {
  constructor() {
    super({
      providerName: "us_visa_scheduling",
      schedulingProvider: "usvisascheduling",
      portal: "https://www.usvisascheduling.com/",
      supportedApplyingCountries: [
        "BD",
        "CN",
        "HK",
        "IN",
        "ID",
        "JP",
        "MY",
        "NP",
        "PH",
        "SG",
        "KR",
        "LK",
        "TW",
        "TH",
        "VN",
      ],
    });
  }
}

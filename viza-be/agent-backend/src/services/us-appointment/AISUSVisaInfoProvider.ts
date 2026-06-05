import { AssistedLiveDisabledProvider } from "./AssistedLiveDisabledProvider.js";

export class AISUSVisaInfoProvider extends AssistedLiveDisabledProvider {
  constructor() {
    super({
      providerName: "ais_us_visa_info",
      schedulingProvider: "ais_usvisa_info",
      portal: "https://ais.usvisa-info.com/",
      supportedApplyingCountries: ["CA", "MX", "AR", "BR", "CL", "CO", "GB"],
    });
  }
}

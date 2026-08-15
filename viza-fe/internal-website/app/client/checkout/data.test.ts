import { describe, expect, it } from "vitest";
import {
  resolveCheckoutPackageSelection,
  resolveGovernmentFee,
  type ApplicationRow,
  type VisaPackageRow,
} from "./data";

const packages = [
  { applicationId: "france-application", packageId: "france-package" },
  { applicationId: "taiwan-application", packageId: "taiwan-package" },
];

describe("resolveCheckoutPackageSelection", () => {
  it("locks an application deep link to that exact application", () => {
    expect(
      resolveCheckoutPackageSelection(packages, {
        applicationId: "taiwan-application",
        packageId: "france-package",
      }),
    ).toEqual(packages[1]);
  });

  it("does not fall back to another package for an unknown application", () => {
    expect(
      resolveCheckoutPackageSelection(packages, {
        applicationId: "missing-application",
      }),
    ).toBeNull();
  });

  it("uses the package selector only when there is no application deep link", () => {
    expect(
      resolveCheckoutPackageSelection(packages, {
        packageId: "france-package",
      }),
    ).toEqual(packages[0]);
  });
});

describe("resolveGovernmentFee", () => {
  it("does not present a placeholder zero as a free official fee", () => {
    const packageRow: VisaPackageRow = {
      id: "france-package",
      country: "france",
      visa_type: "EU_SCHENGEN_C_SHORT_STAY",
      name: "France Schengen Short-Stay Visa",
      description: null,
      price_cents: 9900,
      currency: "USD",
      is_active: true,
      metadata: null,
    };
    const application: ApplicationRow = {
      id: "france-application",
      applicant_id: "applicant",
      country: "france",
      visa_type: "EU_SCHENGEN_C_SHORT_STAY",
      status: "draft",
      visa_package_id: "france-package",
      government_fee_cents: 0,
      government_fee_currency: "USD",
      government_fee_mode: null,
      created_at: null,
      updated_at: null,
    };

    expect(resolveGovernmentFee(packageRow, application).amountLabel).toBe("$90");
  });
});

import "server-only";

import {
  PAY_PER_APPLICATION_PRODUCTS,
  formatCny,
} from "@/lib/payments/commercial-products";
import {
  VISA_DESTINATION_REGION_GROUPS,
  getVisaDestinationsForRegion,
} from "@/lib/visa-destinations";
import type { PayPerRegion } from "./pay-per-types";

export function buildPayPerGroups(): PayPerRegion[] {
  const productsByDestination = new Map(
    PAY_PER_APPLICATION_PRODUCTS.map((product) => [
      `${product.country ?? ""}::${product.visaType ?? ""}`.toLowerCase(),
      product,
    ]),
  );

  return VISA_DESTINATION_REGION_GROUPS.map((region) => {
    const destinations = getVisaDestinationsForRegion(region.id);
    const items = destinations
      .map((destination) => {
        const product = productsByDestination.get(`${destination.country}::${destination.visaType}`.toLowerCase());
        if (!product) return null;

        return {
          id: destination.id,
          productId: product.id,
          name: destination.countryName,
          nameZh: destination.countryNameZh,
          visaName: destination.visaName,
          visaNameZh: destination.visaNameZh,
          amountLabel: formatCny(product.amountFen),
          searchText: [
            destination.countryName,
            destination.countryNameZh,
            destination.visaName,
            destination.visaNameZh,
            destination.region,
            region.name,
            region.nameZh,
            ...(destination.searchAliases ?? []),
          ].join(" ").toLowerCase(),
        };
      })
      .filter((item): item is PayPerRegion["items"][number] => Boolean(item));

    return {
      id: region.id,
      name: region.name,
      nameZh: region.nameZh,
      description: region.description,
      descriptionZh: region.descriptionZh,
      flag: region.flag,
      href: `/client/subscription/regions/${region.id}`,
      items,
    };
  }).filter((group) => group.items.length > 0);
}

export function getPayPerRegion(regionId: string): PayPerRegion | null {
  return buildPayPerGroups().find((region) => region.id === regionId) ?? null;
}

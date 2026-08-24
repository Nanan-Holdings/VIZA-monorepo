/**
 * The hosted draft applications used for live QA of the five 2026-08 tourist
 * products. They belong to a real applicant, so scripts must treat them as
 * production records: read them, drive runners from them, and never fabricate
 * itinerary, reference, insurance, ticket, consent, or signature data in them.
 */
export const FIVE_TOURIST_APPLICATIONS = {
  canada: { visaType: "CA_TRV", applicationId: "74e62018-bab6-4ca4-aa15-f213294b4683" },
  turkey: { visaType: "TR_E_VISA", applicationId: "b8df7a56-aed1-4b7b-8a6c-4e90cc5fe2bf" },
  india: { visaType: "IN_E_VISA", applicationId: "69911d95-8cb1-4d31-b2a6-6899d929b12c" },
  saudi_arabia: { visaType: "SA_E_VISA", applicationId: "de07907d-43eb-4375-a6d7-6b1972b80045" },
  united_arab_emirates: {
    visaType: "AE_TOURIST_VISA",
    applicationId: "cbac3e41-2d4a-44f0-9bf7-2fac12f6508c",
  },
} as const;

export type TouristCountry = keyof typeof FIVE_TOURIST_APPLICATIONS;

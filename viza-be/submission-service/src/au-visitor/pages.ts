/**
 * Page identification for the Australian Subclass 600 ImmiAccount
 * online application (form id `VSS-AP-600`).
 *
 * The live form (verified 2026-04-27) renders 20 logical pages then a
 * Review page. Page IDs are derived from the heading text and the
 * `N/20` page-counter rendered on every page. Page IDs map to fillers
 * in `orchestrator.ts`.
 */

export type AuPageId =
  | "terms_and_conditions"            // 1/20
  | "application_context"             // 2/20
  | "primary_applicant"               // 3/20
  | "critical_data_confirmation"      // 4/20
  | "travelling_companions"           // 5/20
  | "contact_details"                 // 6/20
  | "authorised_recipient"            // 7/20
  | "non_accompanying_family"         // 8/20
  | "entry_to_australia"              // 9/20
  | "australian_addresses"            // 10/20  (visited but skipped on minimum-data walk)
  | "current_overseas_employment"     // 11/20
  | "financial_support"               // 12/20
  | "previous_travel_history"         // 13/20  (conditional)
  | "australian_address_during_visit" // 14/20  (conditional)
  | "police_certificates"             // 15/20  (conditional)
  | "health_declarations"             // 16/20
  | "character_declarations"          // 17/20
  | "visa_history"                    // 18/20
  | "supporting_documents"            // 19/20  (informational)
  | "declarations"                    // 20/20
  | "review_page"                     // post-20 review screen
  | "payment"                         // post-review (out of automation scope)
  | "unknown";

interface PageDescriptor {
  id: AuPageId;
  pageNumber: number | null;
  headingPattern: RegExp;
  /** Optional URL fragment that uniquely identifies the page. */
  urlPattern?: RegExp;
}

const DESCRIPTORS: PageDescriptor[] = [
  { id: "terms_and_conditions",       pageNumber: 1,  headingPattern: /Terms and Conditions/i },
  { id: "application_context",        pageNumber: 2,  headingPattern: /Application context/i },
  { id: "primary_applicant",          pageNumber: 3,  headingPattern: /Primary applicant/i },
  { id: "critical_data_confirmation", pageNumber: 4,  headingPattern: /Critical data confirmation/i },
  { id: "travelling_companions",      pageNumber: 5,  headingPattern: /Travelling companions/i },
  { id: "contact_details",            pageNumber: 6,  headingPattern: /Contact details/i },
  { id: "authorised_recipient",       pageNumber: 7,  headingPattern: /Authorised recipient/i },
  { id: "non_accompanying_family",    pageNumber: 8,  headingPattern: /Non-accompanying members of the family unit/i },
  { id: "entry_to_australia",         pageNumber: 9,  headingPattern: /Entry to Australia/i },
  { id: "australian_addresses",       pageNumber: 10, headingPattern: /Australian addresses/i },
  { id: "current_overseas_employment", pageNumber: 11, headingPattern: /Current overseas employment/i },
  { id: "financial_support",          pageNumber: 12, headingPattern: /Financial support/i },
  { id: "previous_travel_history",    pageNumber: 13, headingPattern: /Previous travel/i },
  { id: "australian_address_during_visit", pageNumber: 14, headingPattern: /Australian address during/i },
  { id: "police_certificates",        pageNumber: 15, headingPattern: /Police certificates?/i },
  { id: "health_declarations",        pageNumber: 16, headingPattern: /Health declarations/i },
  { id: "character_declarations",     pageNumber: 17, headingPattern: /Character declarations/i },
  { id: "visa_history",               pageNumber: 18, headingPattern: /Visa history/i },
  { id: "supporting_documents",       pageNumber: 19, headingPattern: /Supporting documents/i },
  { id: "declarations",               pageNumber: 20, headingPattern: /^Declarations$/i },
  { id: "review_page",                pageNumber: null, headingPattern: /Review Page/i, urlPattern: /\/elp\/app/i },
  { id: "payment",                    pageNumber: null, headingPattern: /Payment summary|Payment details/i },
];

export interface PageDetectionInput {
  url: string;
  headings: string[];
  pageMeta?: string | null;
}

/**
 * Resolve the current page id from a page snapshot.
 * Heading-based detection is preferred; the page-counter is used to
 * disambiguate ties (Review page reuses several section headings).
 */
export function detectPage(input: PageDetectionInput): AuPageId {
  const concat = input.headings.join("  ");
  // URL-first override for the review and payment screens (review
  // sub-pages may reuse section headings)
  if (/Review Page/i.test(concat)) return "review_page";
  if (/Payment summary|Payment details/i.test(concat)) return "payment";

  // Page-counter-based detection beats heading when we have it
  if (input.pageMeta) {
    const m = input.pageMeta.match(/^(\d+)\/(\d+)$/);
    if (m) {
      const pageNumber = Number(m[1]);
      const total = Number(m[2]);
      if (total === 20) {
        const desc = DESCRIPTORS.find((d) => d.pageNumber === pageNumber);
        if (desc) return desc.id;
      }
    }
  }

  for (const desc of DESCRIPTORS) {
    if (desc.headingPattern.test(concat)) return desc.id;
  }
  return "unknown";
}

/**
 * Returns true when the page is one of the data-collection sections
 * the orchestrator must fill.
 */
export function isFillablePage(id: AuPageId): boolean {
  return ![
    "terms_and_conditions",
    "review_page",
    "payment",
    "unknown",
    "supporting_documents",
  ].includes(id);
}

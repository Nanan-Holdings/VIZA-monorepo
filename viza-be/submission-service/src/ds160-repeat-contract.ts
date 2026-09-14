/**
 * The persisted repeat-row contract shared by the DS-160 UI and CEAC runner.
 *
 * The frontend stores the first row under the seed field name and subsequent
 * rows under `${fieldName}__2`, `${fieldName}__3`, and so on.  This file keeps
 * the seed's repeat-group membership, CEAC page identity, and conditional
 * expressions in one typed place.  CEAC control selectors are deliberately
 * unverified until a live DOM capture proves them; callers must inject a
 * verified page/row mapping before an active group can add or remove rows.
 */

import type { CeacPageId } from "./ceac/pages";

export const DS160_REPEAT_GROUP_NAMES = [
  "other_nationality",
  "permanent_resident",
  "trip_purpose",
  "specific_travel_plans",
  "planned_locations",
  "companions",
  "previous_visits",
  "drivers_licenses",
  "visa_refused",
  "immigrant_petition",
  "additional_phones",
  "additional_emails",
  "social_media",
  "other_social_media",
  "lost_passport",
  "us_relatives",
  "former_spouses",
  "previous_employers",
  "education",
  "languages",
  "traveled_countries",
  "organizations",
  "military_service",
] as const;

export type Ds160RepeatGroupName = (typeof DS160_REPEAT_GROUP_NAMES)[number];

/**
 * A locator plan is metadata only.  CEAC's live repeat-row markup has not
 * been verified in this repository, so the checked-in plans cannot be used
 * to drive a live browser by themselves.
 */
export interface RepeatControlLocatorStrategy {
  readonly strategy: "injected-page-row-mapping";
  readonly rowSelector: string | null;
  readonly addSelector: string | null;
  readonly removeSelector: string | null;
  readonly rowIndexAttribute: string;
  readonly verified: false;
  readonly evidence: string;
}

export interface Ds160RepeatGroupContract {
  readonly group: Ds160RepeatGroupName;
  readonly page: CeacPageId;
  readonly rowFieldKeys: readonly string[];
  readonly activation?: string;
  readonly fieldShowIf: Readonly<Record<string, string>>;
  readonly maxItems?: number;
  readonly controls: RepeatControlLocatorStrategy;
}

const UNVERIFIED_CONTROLS: RepeatControlLocatorStrategy = {
  strategy: "injected-page-row-mapping",
  rowSelector: null,
  addSelector: null,
  removeSelector: null,
  rowIndexAttribute: "data-repeat-index",
  verified: false,
  evidence:
    "No live CEAC repeat-row DOM evidence is recorded; inject and verify the page/row mapping before use.",
};

const contract = <T extends Ds160RepeatGroupContract>(value: T): T => value;

/**
 * All 23 repeat groups present in the DS-160 seed.  Field order follows the
 * seed order so a row mapper can use a deterministic order when filling.
 */
export const DS160_REPEAT_GROUP_CONTRACTS: Readonly<
  Record<Ds160RepeatGroupName, Ds160RepeatGroupContract>
> = {
  other_nationality: contract({
    group: "other_nationality",
    page: "personal_information_2",
    rowFieldKeys: [
      "other_nationality_country",
      "other_nationality_has_passport",
      "other_nationality_passport_number",
    ],
    activation: "other_nationality === yes",
    fieldShowIf: {
      other_nationality_passport_number: "other_nationality_has_passport === yes",
    },
    controls: UNVERIFIED_CONTROLS,
  }),
  permanent_resident: contract({
    group: "permanent_resident",
    page: "personal_information_2",
    rowFieldKeys: ["other_permanent_resident_country"],
    activation: "permanent_resident_other_country === yes",
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  trip_purpose: contract({
    group: "trip_purpose",
    page: "travel_information",
    rowFieldKeys: ["purpose_of_trip", "purpose_of_trip_specify"],
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  specific_travel_plans: contract({
    group: "specific_travel_plans",
    page: "travel_information",
    rowFieldKeys: [
      "arrival_date",
      "arrival_flight",
      "arrival_city",
      "departure_date",
      "departure_flight",
      "departure_city",
    ],
    activation: "has_specific_plans === yes",
    fieldShowIf: {},
    maxItems: 1,
    controls: UNVERIFIED_CONTROLS,
  }),
  planned_locations: contract({
    group: "planned_locations",
    page: "travel_information",
    rowFieldKeys: ["planned_location"],
    activation: "has_specific_plans === yes",
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  companions: contract({
    group: "companions",
    page: "travel_companions",
    rowFieldKeys: [
      "companion_surname",
      "companion_given_names",
      "companion_relationship",
    ],
    activation: "has_companions === yes",
    fieldShowIf: {
      companion_surname: "companion_group_travel === no",
      companion_given_names: "companion_group_travel === no",
      companion_relationship: "companion_group_travel === no",
    },
    controls: UNVERIFIED_CONTROLS,
  }),
  previous_visits: contract({
    group: "previous_visits",
    page: "previous_us_travel",
    rowFieldKeys: [
      "previous_visit_date_arrived",
      "previous_visit_length_of_stay",
      "previous_visit_length_of_stay_unit",
    ],
    activation: "has_been_in_us === yes",
    fieldShowIf: {},
    maxItems: 5,
    controls: UNVERIFIED_CONTROLS,
  }),
  drivers_licenses: contract({
    group: "drivers_licenses",
    page: "previous_us_travel",
    rowFieldKeys: ["us_drivers_license_number", "us_drivers_license_state"],
    activation: "has_us_drivers_license === yes",
    fieldShowIf: {},
    maxItems: 5,
    controls: UNVERIFIED_CONTROLS,
  }),
  visa_refused: contract({
    group: "visa_refused",
    page: "previous_us_travel",
    rowFieldKeys: ["refusal_explain"],
    activation: "has_been_refused === yes",
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  immigrant_petition: contract({
    group: "immigrant_petition",
    page: "previous_us_travel",
    rowFieldKeys: ["immigrant_petition_explain"],
    activation: "immigrant_petition_filed === yes",
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  additional_phones: contract({
    group: "additional_phones",
    page: "address_and_phone",
    rowFieldKeys: ["additional_phone"],
    activation: "has_other_phones === yes",
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  additional_emails: contract({
    group: "additional_emails",
    page: "address_and_phone",
    rowFieldKeys: ["additional_email"],
    activation: "has_other_emails === yes",
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  social_media: contract({
    group: "social_media",
    page: "address_and_phone",
    rowFieldKeys: ["social_media_platform", "social_media_handle"],
    fieldShowIf: {
      social_media_handle:
        "social_media_platform !== NONE && social_media_platform !== null",
    },
    controls: UNVERIFIED_CONTROLS,
  }),
  other_social_media: contract({
    group: "other_social_media",
    page: "address_and_phone",
    rowFieldKeys: ["other_social_media_name", "other_social_media_identifier"],
    activation: "has_other_social_media === yes",
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  lost_passport: contract({
    group: "lost_passport",
    page: "passport",
    rowFieldKeys: [
      "lost_passport_number",
      "lost_passport_country",
      "lost_passport_explain",
    ],
    activation: "lost_passport === yes",
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  us_relatives: contract({
    group: "us_relatives",
    page: "family_relatives",
    rowFieldKeys: [
      "us_relative_surname",
      "us_relative_given_names",
      "us_relative_relationship",
      "us_relative_status",
    ],
    activation: "has_immediate_us_relatives === yes",
    fieldShowIf: {},
    maxItems: 5,
    controls: UNVERIFIED_CONTROLS,
  }),
  former_spouses: contract({
    group: "former_spouses",
    page: "family_spouse",
    rowFieldKeys: [
      "former_spouse_surname",
      "former_spouse_given_names",
      "former_spouse_date_of_birth",
      "former_spouse_nationality",
      "former_spouse_city_of_birth",
      "former_spouse_country_of_birth",
      "former_spouse_date_of_marriage",
      "former_spouse_date_marriage_ended",
      "former_spouse_how_marriage_ended",
      "former_spouse_country_marriage_terminated",
    ],
    activation: "marital_status === divorced",
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  previous_employers: contract({
    group: "previous_employers",
    page: "work_education_previous",
    rowFieldKeys: [
      "prev_employer_name",
      "prev_employer_address_street1",
      "prev_employer_address_street2",
      "prev_employer_city",
      "prev_employer_state",
      "prev_employer_postal",
      "prev_employer_country",
      "prev_employer_phone",
      "prev_job_title",
      "prev_supervisor_surname",
      "prev_supervisor_given_names",
      "prev_employment_start_date",
      "prev_employment_end_date",
      "prev_job_duties",
    ],
    activation: "has_previous_employer === yes",
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  education: contract({
    group: "education",
    page: "work_education_previous",
    rowFieldKeys: [
      "education_institution_name",
      "education_address_line1",
      "education_address_line2",
      "education_city",
      "education_state_province",
      "education_postal_code",
      "education_country",
      "education_course_of_study",
      "education_start_date",
      "education_end_date",
    ],
    activation: "has_attended_education === yes",
    fieldShowIf: {},
    controls: UNVERIFIED_CONTROLS,
  }),
  languages: contract({
    group: "languages",
    page: "work_education_additional",
    rowFieldKeys: ["language_name"],
    fieldShowIf: {},
    maxItems: 10,
    controls: UNVERIFIED_CONTROLS,
  }),
  traveled_countries: contract({
    group: "traveled_countries",
    page: "work_education_additional",
    rowFieldKeys: ["traveled_country"],
    activation: "has_traveled_last_five_years === yes",
    fieldShowIf: {},
    maxItems: 20,
    controls: UNVERIFIED_CONTROLS,
  }),
  organizations: contract({
    group: "organizations",
    page: "work_education_additional",
    rowFieldKeys: ["organization_name"],
    activation: "has_belonged_to_organization === yes",
    fieldShowIf: {},
    maxItems: 10,
    controls: UNVERIFIED_CONTROLS,
  }),
  military_service: contract({
    group: "military_service",
    page: "work_education_additional",
    rowFieldKeys: [
      "military_country",
      "military_branch",
      "military_rank",
      "military_specialty",
      "military_date_from",
      "military_date_to",
    ],
    activation: "has_served_military === yes",
    fieldShowIf: {},
    maxItems: 5,
    controls: UNVERIFIED_CONTROLS,
  }),
};

export const DS160_REPEAT_GROUP_CONTRACT_LIST: readonly Ds160RepeatGroupContract[] =
  DS160_REPEAT_GROUP_NAMES.map((group) => DS160_REPEAT_GROUP_CONTRACTS[group]);

export function getDs160RepeatGroupContract(
  group: Ds160RepeatGroupName,
): Ds160RepeatGroupContract {
  return DS160_REPEAT_GROUP_CONTRACTS[group];
}


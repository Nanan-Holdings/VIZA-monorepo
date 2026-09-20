/** A visible, leaf answer row from CEAC's idless review tables. */
export interface ReviewTableRow {
  group: string;
  /** Empty for scalar rows; observed parent ID for nested repeat tables. */
  container: string;
  /** Physical TR order within its review section, including skipped rows. */
  position?: number;
  label: string;
  value: string;
}

/** Explicit formatting observed on CEAC's review surface. */
export interface ReviewTableRule {
  page: "personal" | "travel" | "uscontact" | "family" | "workeducation" | "security";
  section: string;
  group: string;
  /** Observed nested repeat container ID; omitted means a scalar table row. */
  container?: string;
  /** Exact public label; {n} is the one-based repeat row number. */
  label: string;
  /** Read-back field names, in the order required by the format. */
  fields: readonly string[];
  format?: "text" | "aliases" | "name" | "date" | "place" | "length" | "locality" | "na" | "unknown";
  /** A date's checked NA companion; false is verified against the same date. */
  naField?: string;
  /** Select the immediate blank-label continuation after the labeled row. */
  continuation?: true;
  /** Bound repeated school fields to the record starting at this label. */
  scopeAnchor?: string;
}

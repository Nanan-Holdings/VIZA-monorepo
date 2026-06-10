/** Thailand eVisa/eVOA field mappings (RUN-TH-001). Thin wrapper over shared core. */
import { standardFieldMappings, isoToDmySlash, mapAnswers, missingRequired } from "../runners/standard-evisa.js";

export const TH_FIELD_MAPPINGS = standardFieldMappings(isoToDmySlash);
export const mapThAnswers = (a: Record<string, string>) => mapAnswers(TH_FIELD_MAPPINGS, a);
export const thMissingRequired = (a: Record<string, string>) => missingRequired(TH_FIELD_MAPPINGS, a);

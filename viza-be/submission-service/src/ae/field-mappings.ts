/** UAE e-Visa field mappings (RUN-AE-001). Thin wrapper over shared core. */
import { standardFieldMappings, isoToDmySlash, mapAnswers, missingRequired } from "../runners/standard-evisa.js";

export const AE_FIELD_MAPPINGS = standardFieldMappings(isoToDmySlash);
export const mapAeAnswers = (a: Record<string, string>) => mapAnswers(AE_FIELD_MAPPINGS, a);
export const aeMissingRequired = (a: Record<string, string>) => missingRequired(AE_FIELD_MAPPINGS, a);

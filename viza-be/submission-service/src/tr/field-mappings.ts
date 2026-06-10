/** Türkiye e-Visa field mappings (RUN-TR-001). Thin wrapper over shared core. */
import { standardFieldMappings, isoToDmySlash, mapAnswers, missingRequired } from "../runners/standard-evisa.js";

export const TR_FIELD_MAPPINGS = standardFieldMappings(isoToDmySlash);
export const mapTrAnswers = (a: Record<string, string>) => mapAnswers(TR_FIELD_MAPPINGS, a);
export const trMissingRequired = (a: Record<string, string>) => missingRequired(TR_FIELD_MAPPINGS, a);

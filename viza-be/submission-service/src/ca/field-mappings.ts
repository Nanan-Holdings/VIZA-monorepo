/**
 * Canada eTA/TRV field mappings (RUN-CA-001). Thin wrapper over the shared
 * standard-e-Visa core (RUN-CORE-001). Best-effort selectors pending recon.
 */
import { standardFieldMappings, isoToDmySlash, mapAnswers, missingRequired } from "../runners/standard-evisa.js";

export const CA_FIELD_MAPPINGS = standardFieldMappings(isoToDmySlash);
export const mapCaAnswers = (answers: Record<string, string>) => mapAnswers(CA_FIELD_MAPPINGS, answers);
export const caMissingRequired = (answers: Record<string, string>) => missingRequired(CA_FIELD_MAPPINGS, answers);

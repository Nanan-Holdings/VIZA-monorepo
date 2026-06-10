/**
 * Canada fillers (RUN-CA-001). The actual fill loop lives in the shared
 * standard-e-Visa core; this re-exports the fill-plan helpers for parity
 * with the other country runners' file layout.
 */
export { mapAnswers as planCaFields, type MappedField } from "../runners/standard-evisa.js";

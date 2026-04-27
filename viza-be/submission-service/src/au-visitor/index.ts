/**
 * Public entrypoint for the Australia Subclass 600 (Visitor Visa)
 * submission service. Mirrors the shape of `france-visas/index.ts`
 * and `ceac/index.ts` so the queue worker dispatches all three
 * submission flows through one polymorphic interface.
 */

export * from "./run";
export * from "./pages";
export * from "./errors";
export * as selectors from "./selectors";
export * as aspnet from "./aspnet";

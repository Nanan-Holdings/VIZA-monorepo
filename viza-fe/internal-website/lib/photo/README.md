# Photo crop pipeline

`cropToSpec(sourceBuffer, spec, cropRegion?)` from `crop.ts` is the only entry point. It returns a JPEG buffer sized exactly to the consulate spec's `widthMm × heightMm @ dpi`.

## Runtime contract

- **Server-only** — never import this module in a client component. The `sharp` native binding requires a Node runtime.
- **`sharp` is a hard dependency** (declared in `viza-fe/internal-website/package.json`). The module loads it lazily so unit tests + tsc run without it on machines that haven't yet installed native deps, but production builds **must** ship it.
- **Vercel runtime**: works on Node serverless runtimes. Edge runtime is unsupported.

## Specs

Specs are sourced from the `photo_spec` table (migration `0071_photo_spec.sql`). Seed rows cover the eleven shipped countries; see migration for the canonical dimensions.

`processApplicantPhoto` in `app/actions/photo-crop.ts` resolves the spec for the application's package, downloads the original applicant_photo from storage, crops, and uploads the result alongside as `<original>.cropped.jpg` with `application_documents.document_type='applicant_photo_cropped'`.

## Adding a country

1. Add a row to `photo_spec` for `(country, visa_type)` with `width_mm` + `height_mm` + `dpi` + optional `eyeline_from_top` + `head_height_pct`.
2. Re-run `processApplicantPhoto` for a sample applicant; verify the crop matches the consulate's submission portal preview.
3. Update `docs/operations/photo-spec.md` if procedural notes change.

## Crop region resolution

- If the caller passes `cropRegion`, it is used verbatim (clamped to the source image bounds).
- Otherwise `centeredCropForAspect` derives a region from the spec's aspect ratio.
- Client-side face detection (`browser FaceDetector` API in `components/photo-crop-tool.tsx`) supplies the region from the detected face box when available — the head-height-pct heuristic places the face appropriately.

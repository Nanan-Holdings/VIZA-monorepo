# Automated Product Source Monitoring

Scope: official-source manifests and read-only weekly drift checks for
`JP_VISIT_JAPAN_WEB` and `KE_ETA`.

- Keep URLs limited to official Digital Agency, Immigration Services Agency,
  Japan Customs, and Kenya Directorate of Immigration Services pages.
- The checker normalizes visible page text, computes SHA-256, and evaluates
  required-text assertions against the committed baseline hash.
- A changed hash, failed status, missing page, or failed assertion emits a
  `review-needed` finding only. It must never edit the manifest, RAG seeds,
  database, runner code, or production rules.
- Review findings are evidence for a human update; do not auto-publish a new
  baseline from a scheduled run.

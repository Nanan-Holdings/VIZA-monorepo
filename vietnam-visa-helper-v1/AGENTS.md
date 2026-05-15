# Vietnam Visa Helper Agent Instructions

This folder contains the Chrome extension that assists users on `evisa.gov.vn`.
Treat it as a standalone extension inside the VIZA monorepo.

## Scope

- Work only inside `vietnam-visa-helper-v1/` unless the user explicitly asks for monorepo changes.
- Do not update root `prd.json`, `progress.txt`, or PRD story status for plugin-only tasks.
- Keep changes small and focused. This extension is loaded unpacked in Chrome, so avoid build steps unless a package is added intentionally.

## Architecture

- `manifest.json` is the Manifest V3 entrypoint.
- `content.js` injects the floating helper panel, field labels, form automation, guidance, modals, and notifications into `evisa.gov.vn`.
- `styles.css` styles injected content-script UI. Keep selectors prefixed with `vh-` or scoped to `#visa-helper-panel`.
- `background.js` owns service-worker logic, default profile data, Supabase calls, and upload persistence.
- `popup.html` / `popup.js` power the extension popup and standalone upload page.
- `options.html` / `options.js` power the settings page.

## Design System

Match the VIZA frontend style from `viza-fe/internal-website`:

- Brand navy: `#03346E`; hover navy: `#022B5C`; accent blue: `#3D6DAD`.
- Page background: `#fcfcfc`; cards: `#ffffff`; borders: `#efefef`; inputs: `#e8e8e8`.
- Text: `#3d3d3d`; muted text should use low-opacity black.
- Prefer 8px inputs, 12-16px cards, and pill buttons for compact extension controls.
- Keep UI dense, operational, and calm. This is a tool surface, not a marketing page.

## Coding Rules

- Use plain JavaScript and browser APIs. Do not introduce a framework unless explicitly requested.
- Avoid `any`-style untyped assumptions in docs or JSDoc. Be precise about message shapes when adding them.
- Keep content-script CSS isolated; do not style global elements without a `vh-` prefix unless absolutely necessary.
- Prefer class-based styling in `styles.css` over inline `style.cssText`.
- Preserve existing Chrome message names and storage keys unless migrating deliberately.
- Do not run `npm install` unless a new dependency is required.

## Verification

Run checks from the plugin directory or repo root:

```powershell
node --check content.js
node --check background.js
node --check popup.js
node --check options.js
```

When UI behavior changes, also run the relevant Playwright smoke test from the repo root if available:

```powershell
npx playwright test vietnam-visa-helper-v1/playwright-extension-smoke.spec.js
```

If Playwright is unavailable or too slow, state that clearly in the handoff.

# Vietnam Visa Helper DG

DG means Design and Development Guide for future agents working on this plugin.

## Product Role

Vietnam Visa Helper is a lightweight Chrome extension for Chinese-speaking users applying through the official Vietnam eVisa site. The extension should feel like part of the VIZA product family: quiet, reliable, and operational, with strong guidance only when the user needs to act.

## UI Surfaces

1. Popup: `popup.html`
   - Main launch surface for site navigation, cloud login, image upload, guide, and settings.
   - Also opens as `popup.html?mode=upload` for a wider standalone upload page.

2. Options page: `options.html`
   - Settings and Supabase session controls.
   - Opens in a full browser tab.

3. Injected helper UI: `content.js` + `styles.css`
   - Floating panel: `#visa-helper-panel`.
   - Field labels and hints: `.vh-chinese-label`, `.vh-hint-box`.
   - Guidance banners, notifications, modals, disclaimer prompts.

## VIZA Visual Language

Use these tokens consistently:

```css
--vh-brand: #03346e;
--vh-brand-600: #022b5c;
--vh-brand-400: #3d6dad;
--vh-brand-50: #eef3fa;
--vh-text: #3d3d3d;
--vh-muted: rgba(0, 0, 0, 0.52);
--vh-surface: #ffffff;
--vh-soft: #fcfcfc;
--vh-border: #efefef;
--vh-input: #e8e8e8;
```

Status colors:

- Success: `#15803d` on `#f0faf4`.
- Warning: `#a8644d` on `#fdf5f1`.
- Danger: `#b42318` on a pale red background.

## Component Guidance

- Buttons: pill-shaped, 38-42px tall, brand primary for the main action, white or brand-50 for secondary actions.
- Inputs: 40-42px tall in extension surfaces, 8px radius, `#e8e8e8` border, brand focus ring.
- Cards and panels: white, `#efefef` border, 12-16px radius, subtle shadow.
- Floating content panel: compact, high z-index, strongly scoped CSS, no global body/page overrides.
- Notifications: short, right-bottom placement, class-based styling, auto-dismiss.
- Modals: use `.vh-modal`, `.vh-modal-content`, `.vh-modal-header`, `.vh-modal-body`, `.vh-modal-actions`.

## Implementation Notes

- `content.js` can run on a hostile and changing third-party page. Keep selectors defensive and avoid assuming Ant Design DOM shape will stay stable.
- The official site may rerender fields dynamically, so existing delayed retries and mutation-aware patterns are intentional.
- `popup.js` relies on Chrome extension APIs; tests mock `chrome.runtime` and `chrome.storage`.
- Upload storage key: `vhUploadDocuments`.
- Supabase auth and profile sync are handled through messages to `background.js`; popup/options should not call Supabase directly.

## Safe Change Checklist

- Keep all new injected CSS under `vh-` selectors or `#visa-helper-panel`.
- Check that popup controls keep their existing IDs; JS depends on them.
- Check that options controls keep their existing IDs; JS depends on them.
- Run `node --check` for every edited `.js` file.
- For visual changes, inspect popup, options, and a mock content page when possible.
- Do not commit unrelated monorepo changes that are already present in the working tree.

## Common Files To Review First

- `manifest.json`
- `popup.html`
- `popup.js`
- `options.html`
- `options.js`
- `content.js`
- `styles.css`
- `playwright-extension-smoke.spec.js`

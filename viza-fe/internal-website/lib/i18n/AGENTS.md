# Interface locale

`locale.ts` owns the currently selectable Chinese/English interface locale and
the shared cookie/storage/event write used by every language control. The
next-intl request locale is the display source of truth. Local storage is a
notification mirror, never an override for the cookie or provider locale.

`locale.test.ts` checks switching in both directions and restricted storage.
Legacy email/catalog locales remain separate from the two interface choices.

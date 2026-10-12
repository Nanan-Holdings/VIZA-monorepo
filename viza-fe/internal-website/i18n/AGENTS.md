# Internationalization

`catalog-alignment.test.ts` guards English/Chinese key parity, ICU argument and
rich-text-tag parity, and accidental Chinese copy in the English catalog.
`travel-summary-alignment.test.ts` covers language changes on historical
structured Travel messages and preservation of applicant-authored notes.
`auth-surfaces-alignment.test.tsx` covers verification errors and password-reset
form state while switching the interface language, using mocked auth requests.

`request.ts` selects the supported locale from `NEXT_LOCALE` and supplies the
full catalog to server translations. `client-provider.tsx` selects one explicit
dynamic JSON import and uses React 19 `use()` inside Suspense. Keep the finite
public import promise cache in this client boundary, including during SSR.

The root server `NextIntlClientProvider` passes `messages={null}` and retains
the inherited locale, time zone, formats, and configured now. The nested client
provider supplies messages from its locale chunk, avoiding repeated catalog
serialization in Flight. Never trim messages based on the initial route:
the root persists during client navigation. Language changes continue to use
the cookie plus `router.refresh()`; keep the provider component type stable so
changing locale does not remount forms or erase entered values. Do not disable
SSR or fetch catalogs in an effect. The current interface offers English and
Chinese; retain legacy locale chunks without expanding their UI availability.

Standalone verification, password-reset, account-recovery and subscription
payment pages use the same catalogs and cookie preference as the client shell.
Store error/status identifiers rather than translated strings when the message
must update during an interface language change.

Validate translated SSR, hydration, navigation between namespaces, locale
refresh, and that inactive catalogs are not requested in a production build.
If a locale chunk rejects, keep its rejected promise cached until the user
clicks the local retry button; never delete it from an automatic catch. The
retry clears only that locale, while changing locale keeps the provider type
stable and resets the boundary state without remounting descendants.
`client-provider.test.tsx` covers full catalog parity, inherited Intl config,
form state/DOM preservation while changing language, and the four-language
chunk recovery boundary with explicit retry.

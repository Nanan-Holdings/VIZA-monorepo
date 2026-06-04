/**
 * Per-country residential-IP geography overrides (INFRA-004).
 *
 * Most flows are routed via a residential IP geolocated to the
 * applicant's claimed country. The corridors below override that —
 * see docs/infra/proxy-pool.md for the why.
 *
 * Keys are the internal country slug used on `applications.country`.
 */

export interface ProxyOverride {
  country: string;
  /** ISO-3166-1 alpha-2 code Bright Data uses in the username. */
  brightDataCountry: string;
  /** Optional Bright Data city pin. */
  city?: string;
  /** Why we override — surfaced in the proxy session metadata. */
  reason: string;
}

export const PROXY_COUNTRY_OVERRIDES: Readonly<Record<string, ProxyOverride>> =
  {
    // Italy via VFS-CN: vfsglobal.com PRC mirror geo-fences requests.
    italy_vfs_cn: {
      country: "italy_vfs_cn",
      brightDataCountry: "cn",
      city: "shanghai",
      reason: "VFS-CN mirror geo-fences requests outside mainland China",
    },
    // US CEAC: anti-bot tolerates US residential but pushes back on
    // datacenter IPs. Always egress via US even when the applicant is
    // foreign-resident.
    united_states: {
      country: "united_states",
      brightDataCountry: "us",
      reason: "CEAC anti-bot tolerates US residential",
    },
    // Vietnam: tolerant of foreign IPs but the user-agent locale
    // fingerprint stays coherent when egress is in-country.
    vietnam: {
      country: "vietnam",
      brightDataCountry: "vn",
      reason: "keep user-agent locale fingerprint coherent",
    },
  };

/**
 * Resolve the egress geography for a country. Returns the override
 * when one exists, else falls back to a country slug → ISO-3166-1
 * α-2 mapping for Bright Data.
 */
const SLUG_TO_ISO2: Readonly<Record<string, string>> = {
  united_kingdom: "gb",
  european_union: "fr", // Default to FR for Schengen (France-Visas hub)
  france: "fr",
  italy: "it",
  saudi_arabia: "sa",
  australia: "au",
  japan: "jp",
  indonesia: "id",
  egypt: "eg",
  south_korea: "kr",
  thailand: "th",
  malaysia: "my",
  singapore: "sg",
  hong_kong: "hk",
  macau: "mo",
  new_zealand: "nz",
  philippines: "ph",
  cambodia: "kh",
  laos: "la",
  sri_lanka: "lk",
  india: "in",
  maldives: "mv",
  russia: "ru",
  turkey: "tr",
  united_arab_emirates: "ae",
  canada: "ca",
  south_africa: "za",
};

export function resolveEgressCountry(country: string): {
  brightDataCountry: string;
  city?: string;
  override: ProxyOverride | null;
} {
  const ovr = PROXY_COUNTRY_OVERRIDES[country];
  if (ovr) {
    return { brightDataCountry: ovr.brightDataCountry, city: ovr.city, override: ovr };
  }
  const iso2 = SLUG_TO_ISO2[country];
  if (!iso2) {
    throw new Error(
      `[proxy] no egress mapping for country ${country}. Add to country-overrides.ts.`,
    );
  }
  return { brightDataCountry: iso2, override: null };
}

/**
 * RUN-CORE-006: assert every launch country resolves to a proxy egress
 * geography. Returns the list of countries with no mapping (empty = full
 * coverage). Called by DEP-003 validate-env at startup.
 */
export function proxyCoverageGaps(countries: readonly string[]): string[] {
  const gaps: string[] = [];
  for (const c of countries) {
    try {
      resolveEgressCountry(c);
    } catch {
      gaps.push(c);
    }
  }
  return gaps;
}

function cleanHeaderValue(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

function firstForwardedIp(value: string | null): string {
  return cleanHeaderValue(value).split(",")[0]?.trim() ?? "";
}

const COUNTRY_NAME_BY_CODE: Record<string, string> = {
  AU: "Australia",
  CA: "Canada",
  CN: "China",
  DE: "Germany",
  ES: "Spain",
  FR: "France",
  GB: "United Kingdom",
  HK: "Hong Kong",
  ID: "Indonesia",
  IN: "India",
  IT: "Italy",
  JP: "Japan",
  KR: "South Korea",
  MY: "Malaysia",
  NL: "Netherlands",
  PH: "Philippines",
  SG: "Singapore",
  TH: "Thailand",
  US: "United States",
  VN: "Vietnam",
};

type IpLocation = {
  city: string;
  country: string;
  countryCode?: string;
  source: string;
};

function isPublicIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === "::1" || ip.startsWith("127.")) return false;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return false;
  const private172 = /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
  return !private172;
}

function countryNameFromCode(countryCode: string): string {
  const normalizedCode = countryCode.trim().toUpperCase();
  if (!normalizedCode) return "";
  const knownName = COUNTRY_NAME_BY_CODE[normalizedCode];
  if (knownName) return knownName;

  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return displayNames.of(normalizedCode) ?? "";
  } catch {
    return "";
  }
}

function resolveCountryName(country: string, countryCode?: string): string {
  const normalizedCountry = country.trim();
  if (normalizedCountry.length > 2) return normalizedCountry;

  const normalizedCode = (countryCode || normalizedCountry).trim().toUpperCase();
  return countryNameFromCode(normalizedCode) || normalizedCountry;
}

function locationFromHeaders(headers: Headers): IpLocation | null {
  const city =
    cleanHeaderValue(headers.get("x-vercel-ip-city")) ||
    cleanHeaderValue(headers.get("cf-ipcity"));
  const rawCountry =
    cleanHeaderValue(headers.get("x-vercel-ip-country")) ||
    cleanHeaderValue(headers.get("cf-ipcountry"));
  const countryCode = rawCountry.trim().toUpperCase();
  const country = resolveCountryName(rawCountry, countryCode);

  if (!city || !country) return null;

  return {
    city,
    country,
    countryCode: countryCode || undefined,
    source: "edge-headers",
  };
}

function coerceIpApiLocation(raw: unknown): IpLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const city = typeof record.city === "string" ? record.city.trim() : "";
  const rawCountry =
    typeof record.country_name === "string"
      ? record.country_name.trim()
      : typeof record.country === "string"
        ? record.country.trim()
        : "";
  const countryCode =
    typeof record.country_code === "string"
      ? record.country_code.trim()
      : typeof record.country === "string"
        ? record.country.trim()
        : "";
  const country = resolveCountryName(rawCountry, countryCode);

  if (!city || !country) return null;
  return {
    city,
    country,
    countryCode,
    source: "ipapi",
  };
}

function coerceIpWhoIsLocation(raw: unknown): IpLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const success = typeof record.success === "boolean" ? record.success : true;
  if (!success) return null;

  const city = typeof record.city === "string" ? record.city.trim() : "";
  const rawCountry =
    typeof record.country === "string" ? record.country.trim() : "";
  const countryCode =
    typeof record.country_code === "string" ? record.country_code.trim() : "";
  const country = resolveCountryName(rawCountry, countryCode);

  if (!city || !country) return null;
  return {
    city,
    country,
    countryCode,
    source: "ipwho.is",
  };
}

function coerceIpInfoLocation(raw: unknown): IpLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const city = typeof record.city === "string" ? record.city.trim() : "";
  const countryCode =
    typeof record.country === "string" ? record.country.trim() : "";
  const country = countryNameFromCode(countryCode);

  if (!city || !country) return null;
  return {
    city,
    country,
    countryCode,
    source: "ipinfo",
  };
}

function coerceIpApiComLocation(raw: unknown): IpLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const status = typeof record.status === "string" ? record.status : "";
  if (status && status !== "success") return null;

  const city = typeof record.city === "string" ? record.city.trim() : "";
  const rawCountry =
    typeof record.country === "string" ? record.country.trim() : "";
  const countryCode =
    typeof record.countryCode === "string" ? record.countryCode.trim() : "";
  const country = resolveCountryName(rawCountry, countryCode);

  if (!city || !country) return null;
  return {
    city,
    country,
    countryCode,
    source: "ip-api.com",
  };
}

function coerceGeoLocationDbLocation(raw: unknown): IpLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const city = typeof record.city === "string" ? record.city.trim() : "";
  const rawCountry =
    typeof record.country_name === "string" ? record.country_name.trim() : "";
  const countryCode =
    typeof record.country_code === "string" ? record.country_code.trim() : "";
  const country = resolveCountryName(rawCountry, countryCode);

  if (!city || !country) return null;
  return {
    city,
    country,
    countryCode,
    source: "geolocation-db",
  };
}

function coerceFreeIpApiLocation(raw: unknown): IpLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const city = typeof record.cityName === "string" ? record.cityName.trim() : "";
  const rawCountry =
    typeof record.countryName === "string" ? record.countryName.trim() : "";
  const countryCode =
    typeof record.countryCode === "string" ? record.countryCode.trim() : "";
  const country = resolveCountryName(rawCountry, countryCode);

  if (!city || !country) return null;
  return {
    city,
    country,
    countryCode,
    source: "freeipapi",
  };
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "VIZA Travel Planner location lookup",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const headerLocation = locationFromHeaders(request.headers);
  if (headerLocation) {
    return Response.json(headerLocation);
  }

  const forwardedIp =
    firstForwardedIp(request.headers.get("x-forwarded-for")) ||
    cleanHeaderValue(request.headers.get("x-real-ip"));
  const lookupUrl = isPublicIp(forwardedIp)
    ? `https://ipapi.co/${forwardedIp}/json/`
    : "https://ipapi.co/json/";
  const ipInfoUrl = isPublicIp(forwardedIp)
    ? `https://ipinfo.io/${forwardedIp}/json`
    : "https://ipinfo.io/json";
  const ipApiComUrl = isPublicIp(forwardedIp)
    ? `http://ip-api.com/json/${forwardedIp}?fields=status,country,countryCode,city,message`
    : "http://ip-api.com/json/?fields=status,country,countryCode,city,message";
  const freeIpApiUrl = isPublicIp(forwardedIp)
    ? `https://freeipapi.com/api/json/${forwardedIp}`
    : "https://freeipapi.com/api/json";

  const providerCandidates = [
    {
      source: "ipinfo",
      url: ipInfoUrl,
      coerce: coerceIpInfoLocation,
    },
    {
      source: "geolocation-db",
      url: "https://geolocation-db.com/json/",
      coerce: coerceGeoLocationDbLocation,
    },
    {
      source: "ip-api.com",
      url: ipApiComUrl,
      coerce: coerceIpApiComLocation,
    },
    {
      source: "freeipapi",
      url: freeIpApiUrl,
      coerce: coerceFreeIpApiLocation,
    },
    {
      source: "ipapi",
      url: lookupUrl,
      coerce: coerceIpApiLocation,
    },
    {
      source: "ipwho.is",
      url: isPublicIp(forwardedIp)
        ? `https://ipwho.is/${forwardedIp}`
        : "https://ipwho.is/",
      coerce: coerceIpWhoIsLocation,
    },
  ];
  const errors: string[] = [];

  for (const provider of providerCandidates) {
    try {
      const payload = await fetchJsonWithTimeout(provider.url);
      const location = provider.coerce(payload);
      if (location) {
        return Response.json(location);
      }
      errors.push(`${provider.source}: empty location`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "request failed";
      errors.push(`${provider.source}: ${message}`);
    }
  }

  return Response.json(
    {
      error: "Unable to resolve IP location.",
      details: errors,
    },
    { status: 502 }
  );
}

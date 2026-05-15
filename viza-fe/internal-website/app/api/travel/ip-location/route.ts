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

function isPublicIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === "::1" || ip.startsWith("127.")) return false;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return false;
  const private172 = /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
  return !private172;
}

function locationFromHeaders(headers: Headers) {
  const city =
    cleanHeaderValue(headers.get("x-vercel-ip-city")) ||
    cleanHeaderValue(headers.get("cf-ipcity"));
  const country =
    cleanHeaderValue(headers.get("x-vercel-ip-country")) ||
    cleanHeaderValue(headers.get("cf-ipcountry"));

  if (!city || !country || country.length <= 2) return null;

  return {
    city,
    country,
    countryCode: cleanHeaderValue(headers.get("x-vercel-ip-country")) || country,
    source: "edge-headers",
  };
}

function coerceExternalLocation(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const city = typeof record.city === "string" ? record.city.trim() : "";
  const country =
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

  if (!city || !country) return null;
  return {
    city,
    country,
    countryCode,
    source: "ipapi",
  };
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

  try {
    const response = await fetch(lookupUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return Response.json(
        { error: "Unable to resolve IP location." },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as unknown;
    const location = coerceExternalLocation(payload);
    if (!location) {
      return Response.json(
        { error: "Unable to resolve IP location." },
        { status: 404 }
      );
    }

    return Response.json(location);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to resolve IP location.";
    return Response.json({ error: message }, { status: 502 });
  }
}

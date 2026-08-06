import { NextRequest, NextResponse } from "next/server";
import {
  assessIndonesiaAccommodationAddress,
  normalizeIndonesiaPostalCode,
  parseIndonesiaPostalDirectoryResponse,
  selectBestIndonesiaPostalLocation,
} from "@/lib/indonesia-postal-code";

export const dynamic = "force-dynamic";

const POSTAL_DIRECTORY_URL = "https://carikodepos.id/api/postal-codes";

function getAddressDirectoryTerms(address: string): string[] {
  return address
    .split(",")
    .map((part) => part.trim().replace(/^(?:kec(?:amatan)?\.?|kab(?:upaten)?\.?)\s+/i, ""))
    .filter((part) => part.length >= 3 && part.length <= 40)
    .filter((part) => !/^(?:jl\.?|jalan|indonesia)\b|\d{5}/i.test(part))
    .slice(0, 3);
}

async function fetchPostalDirectory(search: string): Promise<unknown> {
  const upstream = await fetch(`${POSTAL_DIRECTORY_URL}?search=${encodeURIComponent(search)}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86_400 },
  });
  if (!upstream.ok) throw new Error(`Postal directory returned ${upstream.status}`);
  return upstream.json();
}

export async function GET(request: NextRequest) {
  const postalCode = normalizeIndonesiaPostalCode(request.nextUrl.searchParams.get("postalCode"));
  const address = request.nextUrl.searchParams.get("address") ?? "";
  if (!postalCode) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_postal_code",
        messageZh: "请输入 5 位印尼邮政编码。",
        messageEn: "Enter a 5-digit Indonesian postal code.",
      },
      { status: 400 },
    );
  }

  try {
    const payloads = await Promise.all([
      fetchPostalDirectory(postalCode),
      ...getAddressDirectoryTerms(address).map(fetchPostalDirectory),
    ]);
    const candidates = payloads
      .map((payload) => parseIndonesiaPostalDirectoryResponse(payload, postalCode, address))
      .filter((location) => location !== null);
    const uniqueCandidates = [...new Map(candidates.map((location) => [
      [location.province, location.city, location.district, location.village].join("|"),
      location,
    ])).values()];
    const location = selectBestIndonesiaPostalLocation(uniqueCandidates, address);
    if (!location) {
      return NextResponse.json(
        {
          ok: false,
          code: "postal_code_not_found",
          messageZh: "未找到该印尼邮政编码，无法自动填写省、市、区和村。请确认住宿地址对应的 5 位邮编。",
          messageEn: "This Indonesian postal code was not found, so the province, city, district, and village cannot be filled automatically. Check the 5-digit postal code for your accommodation.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      postalCode,
      location,
      addressCheck: assessIndonesiaAccommodationAddress(address, location),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "postal_lookup_unavailable",
        messageZh: "暂时无法校验印尼邮政编码，请稍后重试。",
        messageEn: "Indonesia postal-code validation is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }
}

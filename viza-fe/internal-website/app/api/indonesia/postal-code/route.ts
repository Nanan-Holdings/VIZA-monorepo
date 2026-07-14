import { NextRequest, NextResponse } from "next/server";
import {
  assessIndonesiaAccommodationAddress,
  normalizeIndonesiaPostalCode,
  parseIndonesiaPostalDirectoryResponse,
} from "@/lib/indonesia-postal-code";

export const dynamic = "force-dynamic";

const POSTAL_DIRECTORY_URL = "https://carikodepos.id/api/postal-codes";

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
    const upstream = await fetch(`${POSTAL_DIRECTORY_URL}?search=${encodeURIComponent(postalCode)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
    });
    if (!upstream.ok) throw new Error(`Postal directory returned ${upstream.status}`);

    const location = parseIndonesiaPostalDirectoryResponse(await upstream.json(), postalCode);
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

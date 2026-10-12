import { permanentRedirect } from "next/navigation";

/**
 * VIZA's service is free (payments were retired on 2026-09-15), so there is
 * no refund policy to publish. Old links land on the terms, which explain fees.
 */
export default async function RefundsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  permanentRedirect(`${locale === "en" ? "" : `/${locale}`}/legal/terms#fees`);
}

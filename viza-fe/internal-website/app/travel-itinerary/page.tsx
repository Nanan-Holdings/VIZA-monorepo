import type { Metadata } from "next";
import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { TravelItineraryShareRenderer } from "@/components/client/travel/travel-itinerary-share-renderer";

export async function generateMetadata(): Promise<Metadata> {
  const isZh = (await getLocale()).startsWith("zh");
  return { title: isZh ? "旅行行程" : "Travel Itinerary", description: isZh ? "分享的旅行行程" : "Shared travel itinerary" };
}

export default function TravelItineraryPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f4f0] px-5 py-8 text-[#2d1635]">
          <div className="mx-auto h-40 max-w-5xl animate-pulse rounded-[28px] bg-white" />
        </main>
      }
    >
      <TravelItineraryShareRenderer />
    </Suspense>
  );
}

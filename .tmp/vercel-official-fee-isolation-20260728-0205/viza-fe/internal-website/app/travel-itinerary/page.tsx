import type { Metadata } from "next";
import { Suspense } from "react";
import { TravelItineraryShareRenderer } from "@/components/client/travel/travel-itinerary-share-renderer";

export const metadata: Metadata = {
  title: "Travel Itinery",
  description: "Shared travel itinery",
};

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

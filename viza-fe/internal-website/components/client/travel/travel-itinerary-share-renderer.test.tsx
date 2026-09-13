import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { createInitialTravelState } from "@/lib/travel/planner";
import { buildTravelItinerarySharePayload, encodeTravelItinerarySharePayload } from "./travel-itinerary-data";
import { TravelItineraryShareRenderer } from "./travel-itinerary-share-renderer";

const params = vi.hoisted(() => ({ encoded: null as string | null }));
vi.mock("next/navigation", () => ({ useSearchParams: () => ({ get: () => params.encoded }) }));

function view(locale: "en" | "zh") {
  return <NextIntlClientProvider locale={locale} messages={{}}><TravelItineraryShareRenderer /></NextIntlClientProvider>;
}

describe("shared travel itinerary language", () => {
  it("uses the viewer's language for a Chinese snapshot and switches the labels in place", () => {
    const state = { ...createInitialTravelState(), cities: ["东京"], travel_order: ["东京"], travel_days: 1 };
    params.encoded = encodeTravelItinerarySharePayload(buildTravelItinerarySharePayload("My trip", [{
      day: 1, city: "东京", activities: ["Tokyo Tower"], food: [], cost: "100",
    }], state, [{ type: "景点", date: "第1天", route: "东京", name: "Tokyo Tower", details: "", contact: "-" }], "zh"));
    const result = render(view("en"));
    const table = screen.getByRole("table");
    expect(within(table).getByText("Attraction")).toBeTruthy();
    expect(within(table).getByText("Tokyo")).toBeTruthy();
    expect(within(table).getByText("Day 1")).toBeTruthy();
    result.rerender(view("zh"));
    expect(within(screen.getByRole("table")).getByText("景点")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("东京")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "My trip" })).toBeTruthy();
  });

  it("localizes invalid shared links", () => {
    params.encoded = "invalid";
    const result = render(view("en"));
    expect(screen.getByRole("heading", { name: "Itinerary link unavailable" })).toBeTruthy();
    result.rerender(view("zh"));
    expect(screen.getByRole("heading", { name: "行程链接不可用" })).toBeTruthy();
  });
});

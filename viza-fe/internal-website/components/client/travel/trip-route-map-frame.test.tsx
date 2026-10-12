import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MAP_FRAME_CHANNEL, TripRouteMapFrame } from "./trip-route-map-frame";
import type { TripMapPoint } from "./trip-route-map";

const tokyo: TripMapPoint = { id: "tokyo", kind: "city", label: "Tokyo", subtitle: "Japan", imageSrc: "/travel/cities/tokyo.jpg", lat: 35.68, lng: 139.69 };
function Planner({ locale }: { locale: string }) {
  const [draft, setDraft] = useState("");
  return <NextIntlClientProvider locale={locale} messages={{}} timeZone="UTC">
    <input aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
    <TripRouteMapFrame points={[tokyo]} routeCoordinates={[]} />
  </NextIntlClientProvider>;
}

describe("map locale document boundary", () => {
  it("reloads only the map when changing language and preserves the parent's draft", () => {
    const view = render(<Planner locale="zh" />);
    const draft = screen.getByRole("textbox", { name: "Draft" });
    fireEvent.change(draft, { target: { value: "未发送的旅行计划" } });
    const chineseMap = screen.getByTitle("旅行地图");
    expect(chineseMap).toHaveAttribute("src", "/travel-map?locale=zh");
    view.rerender(<Planner locale="en" />);
    expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
    expect(draft).toHaveValue("未发送的旅行计划");
    expect(screen.getByTitle("Travel map")).toHaveAttribute("src", "/travel-map?locale=en");
    expect(screen.getByTitle("Travel map")).not.toBe(chineseMap);
  });

  it("accepts selection callbacks only from its exact same-origin map document", () => {
    const onSelect = vi.fn();
    const onAdd = vi.fn();
    render(<NextIntlClientProvider locale="en" messages={{}} timeZone="UTC">
      <TripRouteMapFrame points={[tokyo]} routeCoordinates={[]} onPointSelect={onSelect} onAddDestination={onAdd} />
    </NextIntlClientProvider>);
    const frame = screen.getByTitle("Travel map") as HTMLIFrameElement;
    const send = (origin: string, source: Window | null, type = "select") => fireEvent(window, new MessageEvent("message", {
      origin, source, data: { channel: MAP_FRAME_CHANNEL, type, id: tokyo.id, point: tokyo },
    }));
    send("https://external.example", frame.contentWindow);
    send(window.location.origin, window);
    expect(onSelect).not.toHaveBeenCalled();
    send(window.location.origin, frame.contentWindow);
    expect(onSelect).toHaveBeenCalledWith(tokyo.id);
    send(window.location.origin, frame.contentWindow, "add");
    expect(onAdd).toHaveBeenCalledWith(tokyo);
  });
});

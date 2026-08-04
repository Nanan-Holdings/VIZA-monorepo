import { describe, expect, it } from "vitest";
import {
  calculateTripMapHoverCardPlacement,
  createBubbleMarkerDimensions,
} from "./trip-route-map";

describe("TripRouteMap geometry", () => {
  it("keeps the marker anchor on the drawn bubble tip", () => {
    const dimensions = createBubbleMarkerDimensions(56, false);

    expect(dimensions.tipX).toBe(Math.round(dimensions.width / 2));
    expect(dimensions.tipY).toBe(
      dimensions.bubbleBottom + dimensions.tailHeight
    );
    expect(dimensions.tipY).not.toBe(dimensions.height - 2);
  });

  it("clamps the card while preserving the marker coordinate for the pointer", () => {
    const marker = { x: 8, y: 24 };
    const placement = calculateTripMapHoverCardPlacement(
      marker,
      360,
      280,
      240,
      190
    );

    expect(placement.left).toBe(12);
    expect(placement.top).toBeGreaterThanOrEqual(12);
    expect(placement.pointerX + placement.left).toBe(marker.x);
    expect(placement.pointerY + placement.top).toBe(marker.y);
    expect(placement.opensBelow).toBe(true);
  });
});

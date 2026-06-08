import { describe, expect, it } from "vitest";
import {
  TRAVEL_PLACE_FALLBACK_IMAGE,
  filterAndSortGooglePlaces,
  normalizeGooglePlaceToCard,
  normalizeGooglePlaceToDetails,
  scoreGooglePlace,
  type GooglePlace,
} from "@/lib/travel/google-places";

const basePlace = {
  id: "place-1",
  displayName: { text: "Louvre Museum", languageCode: "en" },
  formattedAddress: "Rue de Rivoli, 75001 Paris, France",
  location: { latitude: 48.8606, longitude: 2.3376 },
  primaryType: "museum",
  types: ["museum", "tourist_attraction", "point_of_interest"],
  rating: 4.7,
  userRatingCount: 32000,
  googleMapsUri: "https://maps.google.com/?cid=1",
  businessStatus: "OPERATIONAL",
} satisfies GooglePlace;

describe("google places travel cards", () => {
  it("normalizes Google Places data into a VIZA travel card", () => {
    const card = normalizeGooglePlaceToCard({
      ...basePlace,
      photos: [
        {
          name: "places/place-1/photos/photo-1",
          authorAttributions: [
            {
              displayName: "Google Contributor",
              uri: "//maps.google.com/maps/contrib/1",
            },
          ],
        },
      ],
    });

    expect(card).toMatchObject({
      id: "place-1",
      source: "google",
      title: "Louvre Museum",
      address: "Rue de Rivoli, 75001 Paris, France",
      type: "museum",
      rating: 4.7,
      reviewCount: 32000,
      location: { lat: 48.8606, lng: 2.3376 },
      googleMapsUri: "https://maps.google.com/?cid=1",
    });
    expect(card.imageUrl).toContain("/api/places/photo?name=");
    expect(card.photoName).toBe("places/place-1/photos/photo-1");
    expect(card.attribution?.[0]?.displayName).toBe("Google Contributor");
  });

  it("uses the local fallback image when a place has no photo", () => {
    const card = normalizeGooglePlaceToCard(basePlace);

    expect(card.imageUrl).toBe(TRAVEL_PLACE_FALLBACK_IMAGE);
    expect(card.photoName).toBeUndefined();
  });

  it("normalizes detail-only fields without affecting card shape", () => {
    const details = normalizeGooglePlaceToDetails({
      ...basePlace,
      regularOpeningHours: {
        weekdayDescriptions: ["Monday: 9:00 AM - 6:00 PM"],
      },
      websiteUri: "https://example.com",
      editorialSummary: { text: "A major Paris museum." },
    });

    expect(details.openingHoursText).toEqual(["Monday: 9:00 AM - 6:00 PM"]);
    expect(details.websiteUri).toBe("https://example.com");
    expect(details.editorialSummary).toBe("A major Paris museum.");
  });

  it("filters closed places and sorts by score", () => {
    const withPhoto = {
      ...basePlace,
      id: "place-photo",
      rating: 4.6,
      userRatingCount: 5000,
      photos: [{ name: "places/place-photo/photos/1" }],
    } satisfies GooglePlace;
    const lowerQuality = {
      ...basePlace,
      id: "place-low",
      rating: 3.6,
      userRatingCount: 20,
    } satisfies GooglePlace;
    const closed = {
      ...basePlace,
      id: "place-closed",
      businessStatus: "CLOSED_PERMANENTLY",
    } satisfies GooglePlace;

    const sorted = filterAndSortGooglePlaces(
      [lowerQuality, closed, withPhoto],
      2,
      ["museum"]
    );

    expect(sorted.map((place) => place.id)).toEqual(["place-photo", "place-low"]);
    expect(scoreGooglePlace(withPhoto)).toBeGreaterThan(scoreGooglePlace(lowerQuality));
  });
});

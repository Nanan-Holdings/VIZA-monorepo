export type TravelGooglePhoto = {
  url: string;
  provider: "google_places" | "placeholder";
  attribution?: string | null;
  width?: number | null;
  height?: number | null;
  confidence: number;
  isPlaceholder: boolean;
};

export type TravelGoogleAttraction = {
  nameZh: string;
  nameEn: string;
  latitude: number | null;
  longitude: number | null;
  descriptionZh: string;
  descriptionEn: string;
  photo: TravelGooglePhoto;
  source: "google_places";
  googleMapsUri?: string | null;
  placeId?: string | null;
  category?: string | null;
};

export type TravelGoogleCallEvidence = {
  textSearchCount: number;
  detailsCount: number;
  queries: string[];
  placeIds: string[];
  destinationPlaceId?: string | null;
  destinationQuery?: string | null;
  attractionQueries: string[];
};

export type TravelGoogleEnrichedDestination = {
  id: string;
  canonicalName: string;
  nameZh: string;
  nameEn: string;
  countryCode: string | null;
  adminAreaZh?: string | null;
  adminAreaEn?: string | null;
  latitude: number | null;
  longitude: number | null;
  source: "google_places";
  dataQuality: "api_enriched";
  descriptionZh: string;
  descriptionEn: string;
  descriptionSource:
    | "google_places"
    | "llm_from_google_facts"
    | "local_curated"
    | "fallback_generic";
  coverImage: TravelGooglePhoto;
  attractions: TravelGoogleAttraction[];
  googleMapsUri?: string | null;
  placeId?: string | null;
  calls?: TravelGoogleCallEvidence;
  cache: {
    attempted: boolean;
    stored: boolean;
    skippedReason?: string;
  };
};

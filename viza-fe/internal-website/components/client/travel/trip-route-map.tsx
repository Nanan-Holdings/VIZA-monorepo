"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { isChineseLocale } from "@/lib/i18n/locale";
import {
  findTravelAttraction,
  getTravelAttractionsForCity,
  getTravelCityImage,
} from "@/components/client/travel/travel-attraction-knowledge";
import type { TravelPlaceAttribution } from "@/lib/travel/google-places";

export type TripMapPoint = {
  id: string;
  kind: "city" | "hotel" | "hotspot";
  label: string;
  subtitle: string;
  localName?: string;
  intro?: string;
  countryLabel?: string;
  recommendedDays?: string;
  imageSrc: string;
  lat: number;
  lng: number;
  city?: string;
  source?: "google";
  placeId?: string;
  rating?: number | null;
  reviewCount?: number;
  googleMapsUri?: string;
  attribution?: TravelPlaceAttribution[];
};

type TripRouteMapProps = {
  points: TripMapPoint[];
  routeCoordinates: Array<[number, number]>;
  activePointId?: string | null;
  onPointSelect?: (id: string) => void;
  onAddDestination?: (point: TripMapPoint) => void;
  animateRoute?: boolean;
  className?: string;
};

type GoogleLatLngLiteral = {
  lat: number;
  lng: number;
};

type GoogleMarkerListener = {
  remove: () => void;
};

type GoogleMapMarkerIcon = {
  url: string;
  scaledSize?: unknown;
  anchor?: unknown;
  labelOrigin?: unknown;
};

type GoogleMarkerLabel = {
  text: string;
  color?: string;
  fontSize?: string;
  fontWeight?: string;
};

type GoogleMarkerShape = {
  coords: number[];
  type: "circle" | "poly" | "rect";
};

type DetailSectionId = "attractions" | "food" | "stay" | "nightlife";

type DetailSectionSample = {
  items: string[];
  tip: string;
  tags: string[];
};

type DetailSection = DetailSectionSample & {
  id: DetailSectionId;
  title: string;
  icon: string;
  body: string;
};

type DetailItemMedia = {
  imageSrc?: string;
  description: string;
  sourceUrl?: string;
};

type GoogleMarkerInstance = {
  addListener: (eventName: string, handler: () => void) => GoogleMarkerListener;
  setMap: (map: GoogleMapInstance | null) => void;
  setIcon: (icon?: GoogleMapMarkerIcon) => void;
  setLabel: (label?: GoogleMarkerLabel) => void;
  setZIndex: (zIndex: number) => void;
};

type GoogleMapInstance = {
  fitBounds: (bounds: GoogleLatLngBoundsInstance, padding?: number) => void;
  setCenter: (center: GoogleLatLngLiteral) => void;
  setOptions: (options: Partial<GoogleMapOptions>) => void;
  setZoom: (zoom: number) => void;
  getCenter: () => { lat: () => number; lng: () => number } | null;
  getZoom: () => number | undefined;
  addListener: (eventName: string, handler: () => void) => GoogleMarkerListener;
};

type GoogleInfoWindowInstance = {
  setContent: (content: string) => void;
  setOptions: (options: {
    disableAutoPan?: boolean;
    maxWidth?: number;
    pixelOffset?: unknown;
  }) => void;
  open: (options: {
    map: GoogleMapInstance;
    anchor?: GoogleMarkerInstance;
    shouldFocus?: boolean;
  }) => void;
  close: () => void;
};

type GoogleLatLngBoundsInstance = {
  extend: (point: GoogleLatLngLiteral) => void;
};

type GooglePolylineIconSequence = {
  icon: {
    path: unknown;
    scale?: number;
    strokeColor?: string;
    strokeWeight?: number;
  };
  offset?: string;
  repeat?: string;
};

type GooglePolylineInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
  setPath: (path: GoogleLatLngLiteral[]) => void;
};

type GoogleMapOptions = {
  center: GoogleLatLngLiteral;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  fullscreenControl?: boolean;
  zoomControl?: boolean;
  gestureHandling?: "cooperative" | "greedy" | "none" | "auto";
  restriction?: {
    latLngBounds: {
      north: number;
      south: number;
      west: number;
      east: number;
    };
    strictBounds: boolean;
  };
};

type GoogleMapsNamespace = {
  Map: new (
    container: HTMLElement,
    options: GoogleMapOptions
  ) => GoogleMapInstance;
  Marker: new (options: {
    position: GoogleLatLngLiteral;
    map?: GoogleMapInstance | null;
    title?: string;
    icon?: GoogleMapMarkerIcon;
    label?: GoogleMarkerLabel;
    shape?: GoogleMarkerShape;
    optimized?: boolean;
    zIndex?: number;
  }) => GoogleMarkerInstance;
  InfoWindow: new (options?: {
    content?: string;
    disableAutoPan?: boolean;
  }) => GoogleInfoWindowInstance;
  Polyline: new (options: {
    path: GoogleLatLngLiteral[];
    map?: GoogleMapInstance | null;
    geodesic?: boolean;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    zIndex?: number;
    icons?: GooglePolylineIconSequence[];
  }) => GooglePolylineInstance;
  LatLngBounds: new () => GoogleLatLngBoundsInstance;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  SymbolPath: {
    FORWARD_CLOSED_ARROW: unknown;
  };
  event: {
    clearInstanceListeners: (instance: unknown) => void;
    trigger: (instance: unknown, eventName: string) => void;
    addListener: (
      instance: unknown,
      eventName: string,
      handler: () => void
    ) => GoogleMarkerListener;
    addListenerOnce: (
      instance: unknown,
      eventName: string,
      handler: () => void
    ) => GoogleMarkerListener;
  };
};

declare global {
  interface Window {
    google?: {
      maps?: GoogleMapsNamespace;
    };
  }
}

const DEFAULT_CENTER: GoogleLatLngLiteral = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 2;
const MIN_ZOOM = 2;
const MAX_VISIBLE_LAT = 85;
const VERTICAL_MAP_RESTRICTION = {
  latLngBounds: {
    north: MAX_VISIBLE_LAT,
    south: -MAX_VISIBLE_LAT,
    west: -180,
    east: 180,
  },
  strictBounds: true,
};
const ICON_MIN_SIZE = 44;
const ICON_MAX_SIZE = 84;
const GALLERY_MAX_IMAGES = 8;
const NETWORK_CITY_IMAGES_BY_KEY: Record<string, string[]> = {
  tokyo: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Minato_City%2C_Tokyo%2C_Japan.jpg/960px-Minato_City%2C_Tokyo%2C_Japan.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Minato_City%2C_Tokyo%2C_Japan_%28Night%29.jpg/960px-Minato_City%2C_Tokyo%2C_Japan_%28Night%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Tokyo_Skyline20210123.jpg/960px-Tokyo_Skyline20210123.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Tokyo_Tower%2C_Minato_City.jpg/960px-Tokyo_Tower%2C_Minato_City.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Tokyo_skyline_seen_from_Tokyo_Skytree.jpg/960px-Tokyo_skyline_seen_from_Tokyo_Skytree.jpg",
  ],
  singapore: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/ArtScience_Museum%2C_Marina_Bay_Sands%2C_Singapore.jpg/960px-ArtScience_Museum%2C_Marina_Bay_Sands%2C_Singapore.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Marina_Bay_Singapore-3499.jpg/960px-Marina_Bay_Singapore-3499.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Singapore_Marina_Bay_Dusk_2018-02-27.jpg/960px-Singapore_Marina_Bay_Dusk_2018-02-27.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Skylines_of_the_Central_Business_District%2C_Singapore_at_dusk.jpg/960px-Skylines_of_the_Central_Business_District%2C_Singapore_at_dusk.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Floating_Platform_and_illuminated_East_Coast_Parkway_seen_from_the_sky_observation_deck_of_Marina_Bay_Sands_Singapore.jpg/960px-Floating_Platform_and_illuminated_East_Coast_Parkway_seen_from_the_sky_observation_deck_of_Marina_Bay_Sands_Singapore.jpg",
  ],
  sydney: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Sydney_%28AU%29%2C_Opera_House_--_2019_--_2980.jpg/960px-Sydney_%28AU%29%2C_Opera_House_--_2019_--_2980.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Sydney_%28AU%29%2C_Opera_House_--_2019_--_2994.jpg/960px-Sydney_%28AU%29%2C_Opera_House_--_2019_--_2994.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Sydney_%28AU%29%2C_Opera_House_--_2019_--_3054.jpg/960px-Sydney_%28AU%29%2C_Opera_House_--_2019_--_3054.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Sydney_%28AU%29%2C_Opera_House_--_2019_--_3061-4.jpg/960px-Sydney_%28AU%29%2C_Opera_House_--_2019_--_3061-4.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Sydney_Harbour_Bridge_night.jpg/960px-Sydney_Harbour_Bridge_night.jpg",
  ],
  london: [
    "https://upload.wikimedia.org/wikipedia/commons/4/4e/Big-Ben-Tower-Bridge-and-Tower-London_%282%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Big_Ben_at_sunset_-_2014-10-27_17-30.jpg/960px-Big_Ben_at_sunset_-_2014-10-27_17-30.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/London_%2C_Westminster_-_Bridge_Street_%5E_Queen_Elizabeth_Tower_%28Big_Ben%29_-_geograph.org.uk_-_4068449.jpg/960px-London_%2C_Westminster_-_Bridge_Street_%5E_Queen_Elizabeth_Tower_%28Big_Ben%29_-_geograph.org.uk_-_4068449.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/London_-_Bridge_Road_-_Big_Ben_II.jpg/960px-London_-_Bridge_Road_-_Big_Ben_II.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Palace_of_Westminster%2C_London_-_Feb_2007.jpg/960px-Palace_of_Westminster%2C_London_-_Feb_2007.jpg",
  ],
  paris: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Eiffel_Tower_and_Pont_Alexandre_III_at_night.jpg/960px-Eiffel_Tower_and_Pont_Alexandre_III_at_night.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Eiffel_st-jacques_horz_jms.jpg/960px-Eiffel_st-jacques_horz_jms.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Lightning_striking_the_Eiffel_Tower_-_NOAA.jpg/960px-Lightning_striking_the_Eiffel_Tower_-_NOAA.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Paris_-_The_Eiffel_Tower_in_spring_-_2307.jpg/960px-Paris_-_The_Eiffel_Tower_in_spring_-_2307.jpg",
  ],
  newyork: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Battery_Park_City_New_York_January_2018_002.jpg/960px-Battery_Park_City_New_York_January_2018_002.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Long_Island_City_New_York_May_2015_panorama_3.jpg/960px-Long_Island_City_New_York_May_2015_panorama_3.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/New_York_City_at_night_HDR.jpg/960px-New_York_City_at_night_HDR.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/New_York_Midtown_Skyline_at_night_-_Jan_2006_edit1.jpg/960px-New_York_Midtown_Skyline_at_night_-_Jan_2006_edit1.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu.jpg/960px-View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu.jpg",
  ],
  beijing: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Eastern_Beijing_skyline_from_Forbidden_City.jpg/960px-Eastern_Beijing_skyline_from_Forbidden_City.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Southeast_corner_tower_of_Forbidden_City_and_Beijing_eastern_skyline_%2820241127133425%29.jpg/960px-Southeast_corner_tower_of_Forbidden_City_and_Beijing_eastern_skyline_%2820241127133425%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/View_of_Beijing.jpg/960px-View_of_Beijing.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Wikivoyage_Beijing_skyline_Forbidden_City_banner.jpg/960px-Wikivoyage_Beijing_skyline_Forbidden_City_banner.jpg",
  ],
  sanfrancisco: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Golden_Gate_Bridge%2C_foggy%2C_San_Francisco_%28June_2013%29.jpg/960px-Golden_Gate_Bridge%2C_foggy%2C_San_Francisco_%28June_2013%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Golden_Gate_Bridge%2C_from_Fort_Point%2C_San_Francisco_%28June_2013%29.jpg/960px-Golden_Gate_Bridge%2C_from_Fort_Point%2C_San_Francisco_%28June_2013%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/San_Francisco_Bay_ESA22014515.jpeg/960px-San_Francisco_Bay_ESA22014515.jpeg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/San_Francisco_City_Hall_as_seen_from_100_Van_Ness_at_dusk_%28wide%29.jpg/960px-San_Francisco_City_Hall_as_seen_from_100_Van_Ness_at_dusk_%28wide%29.jpg",
  ],
  pisa: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/The_Leaning_Tower_Pisa_Italy_Travel_Photography_%28158291227%29.jpeg/960px-The_Leaning_Tower_Pisa_Italy_Travel_Photography_%28158291227%29.jpeg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/The_Leaning_Tower_of_Pisa%2C_Pisa%2C_Italy.jpg/960px-The_Leaning_Tower_of_Pisa%2C_Pisa%2C_Italy.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/The_Leaning_Tower_of_Pisa%2C_Sky%2C_Pisa%2C_Italy.jpg/960px-The_Leaning_Tower_of_Pisa%2C_Sky%2C_Pisa%2C_Italy.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Leaning_Tower_of_Pisa.jpg/960px-The_Leaning_Tower_of_Pisa.jpg",
  ],
  rome: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/The_majestic_Colosseum_in_Rome._%28Unsplash%29.jpg/960px-The_majestic_Colosseum_in_Rome._%28Unsplash%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/The_Colosseum%2C_Rome_MET_DT5700.jpg/960px-The_Colosseum%2C_Rome_MET_DT5700.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/67._Colosseum%2C_Rome%2C_Second_View_MET_DP312745.jpg/960px-67._Colosseum%2C_Rome%2C_Second_View_MET_DP312745.jpg",
  ],
  kyoto: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Kiyomizu-dera%2C_Kyoto%2C_November_2016_-01.jpg/960px-Kiyomizu-dera%2C_Kyoto%2C_November_2016_-01.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Kiyomizu-dera%2C_Kyoto%2C_November_2016_-07.jpg/960px-Kiyomizu-dera%2C_Kyoto%2C_November_2016_-07.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Kiyomizu-dera%2C_a_Buddhist_temple_in_eastern_Kyoto%2C_Kyoto_Prefecture%3B_September_2008_%2802%29.jpg/960px-Kiyomizu-dera%2C_a_Buddhist_temple_in_eastern_Kyoto%2C_Kyoto_Prefecture%3B_September_2008_%2802%29.jpg",
  ],
  osaka: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/City_view_from_Osaka_Castle_%286453226205%29.jpg/960px-City_view_from_Osaka_Castle_%286453226205%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Osaka_Castle_%28254929655%29.jpeg/960px-Osaka_Castle_%28254929655%29.jpeg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Dotonbori%2C_Osaka%2C_at_night%2C_November_2016.jpg/960px-Dotonbori%2C_Osaka%2C_at_night%2C_November_2016.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Osaka%2C_Japan_-_Umeda_district_-_city_view_of_Osaka%2C_Japan.jpg/960px-Osaka%2C_Japan_-_Umeda_district_-_city_view_of_Osaka%2C_Japan.jpg",
  ],
  dubai: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Burj_Khalifa_from_a_ferry%2C_Dubai.jpg/960px-Burj_Khalifa_from_a_ferry%2C_Dubai.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Dubai_Skyline_and_Burj_Khalifa_-_25072008.jpg/960px-Dubai_Skyline_and_Burj_Khalifa_-_25072008.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Dubai_Skyline_mit_Burj_Khalifa_%2818241030269%29.jpg/960px-Dubai_Skyline_mit_Burj_Khalifa_%2818241030269%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Dubai_Skyline_mit_Burj_Khalifa_%28cropped%29.jpg/960px-Dubai_Skyline_mit_Burj_Khalifa_%28cropped%29.jpg",
  ],
  bali: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Jimbaran_Bay._Bali_%2815208714849%29.jpg/960px-Jimbaran_Bay._Bali_%2815208714849%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Karma_Kandara_Resort_%28di_Mare_Restaurant%29_hillside_view.jpg/960px-Karma_Kandara_Resort_%28di_Mare_Restaurant%29_hillside_view.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Komune_Resort_and_Beach_Club_Bali%2C_Indonesia_%28Unsplash%29.jpg/960px-Komune_Resort_and_Beach_Club_Bali%2C_Indonesia_%28Unsplash%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Nusa_Dua_1998_03.jpg/960px-Nusa_Dua_1998_03.jpg",
  ],
  moscow: [
    "https://upload.wikimedia.org/wikipedia/commons/5/50/Saint_Basil%27s_Cathedral%2C_Red_Square%2C_Moscow%2C_Russia.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/3/3d/St._Basil_Cathedral%2C_Moscow%2C_Russia_LCCN90713169.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Moscow_City_skyline_at_sunset.jpg/960px-Moscow_City_skyline_at_sunset.jpg",
  ],
  istanbul: [
    "https://upload.wikimedia.org/wikipedia/commons/b/b0/Istanbul_asv2020-02_img45_Hagia_Sophia.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/e/ef/Istanbul_asv2021-10_img21_Hagia_Sophia.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Blue_Mosque_Istanbul_2007.jpg/960px-Blue_Mosque_Istanbul_2007.jpg",
  ],
  melbourne: [
    "https://upload.wikimedia.org/wikipedia/commons/2/24/Melbourne_skyline_2008.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/7/74/Melbourne_skyline_sor.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Melbourne_CBD_from_Southbank.jpg/960px-Melbourne_CBD_from_Southbank.jpg",
  ],
  hawaii: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Waikiki_from_Diamond_Head.jpg/960px-Waikiki_from_Diamond_Head.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Diamond_Head_Hawaii_From_Round_Top_Rd.JPG/960px-Diamond_Head_Hawaii_From_Round_Top_Rd.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Waikiki_Beach%2C_Honolulu%2C_Hawaii.jpg/960px-Waikiki_Beach%2C_Honolulu%2C_Hawaii.jpg",
  ],
  bangkok: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Wat_Arun_Ratchawararam_and_the_Royal_Barge_Procession.jpg/960px-Wat_Arun_Ratchawararam_and_the_Royal_Barge_Procession.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Wat_Arun_Temple_Of_Dawn_%28121412175%29.jpeg/960px-Wat_Arun_Temple_Of_Dawn_%28121412175%29.jpeg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Bangkok_view_of_Saket_Temple_November_1964.jpg/960px-Bangkok_view_of_Saket_Temple_November_1964.jpg",
  ],
  seoul: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Seoul_city_skyline_at_night_from_Namsan_Mountain_%2849174548523%29.jpg/960px-Seoul_city_skyline_at_night_from_Namsan_Mountain_%2849174548523%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Seoul_city_skyline_at_night_from_Namsan_Mountain_%2849175035266%29.jpg/960px-Seoul_city_skyline_at_night_from_Namsan_Mountain_%2849175035266%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Skyline_view_from_Seoul_City_%28South_Korea%29.jpg/960px-Skyline_view_from_Seoul_City_%28South_Korea%29.jpg",
  ],
  hongkong: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Hong_Kong_Harbour_Night_2019-06-11.jpg/960px-Hong_Kong_Harbour_Night_2019-06-11.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Hong_Kong_Night_Skyline.jpg/960px-Hong_Kong_Night_Skyline.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Hong_Kong_Skyline_Restitch_-_Dec_2007.jpg/960px-Hong_Kong_Skyline_Restitch_-_Dec_2007.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/International_Commerce_Centre_on_Victoria_Harbour.jpg/960px-International_Commerce_Centre_on_Victoria_Harbour.jpg",
  ],
  cairo: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Giza_Plateau_%2831762565191%29.jpg/960px-Giza_Plateau_%2831762565191%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Pyramids_of_Giza%2C_Egypt_-_Cairo_skyline_in_the_background_-_panoramio.jpg/960px-Pyramids_of_Giza%2C_Egypt_-_Cairo_skyline_in_the_background_-_panoramio.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/View_over_Cairo_from_Citadel.jpg/960px-View_over_Cairo_from_Citadel.jpg",
  ],
};
const GALLERY_IMAGES_BY_KEY: Record<string, string[]> = {
  tokyo: ["/globe/tokyo.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.tokyo],
  singapore: ["/globe/singapore.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.singapore],
  sydney: ["/globe/sydney.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.sydney],
  london: ["/globe/london.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.london],
  paris: ["/globe/paris.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.paris],
  newyork: ["/globe/nyc.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.newyork],
  nyc: ["/globe/nyc.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.newyork],
  beijing: ["/globe/beijing.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.beijing],
  sanfrancisco: ["/globe/sf.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.sanfrancisco],
  sf: ["/globe/sf.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.sanfrancisco],
  pisa: ["/globe/pisa.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.pisa],
  egypt: ["/globe/egypt.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.cairo],
  cairo: ["/globe/egypt.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.cairo],
  rome: NETWORK_CITY_IMAGES_BY_KEY.rome,
  kyoto: NETWORK_CITY_IMAGES_BY_KEY.kyoto,
  osaka: NETWORK_CITY_IMAGES_BY_KEY.osaka,
  dubai: NETWORK_CITY_IMAGES_BY_KEY.dubai,
  bali: NETWORK_CITY_IMAGES_BY_KEY.bali,
  moscow: NETWORK_CITY_IMAGES_BY_KEY.moscow,
  istanbul: NETWORK_CITY_IMAGES_BY_KEY.istanbul,
  melbourne: NETWORK_CITY_IMAGES_BY_KEY.melbourne,
  hawaii: NETWORK_CITY_IMAGES_BY_KEY.hawaii,
  bangkok: NETWORK_CITY_IMAGES_BY_KEY.bangkok,
  seoul: NETWORK_CITY_IMAGES_BY_KEY.seoul,
  hongkong: NETWORK_CITY_IMAGES_BY_KEY.hongkong,
  marinabaysands: [
    "/globe/singapore.jpg",
    ...NETWORK_CITY_IMAGES_BY_KEY.singapore,
  ],
  gardensbythebay: [
    "/globe/singapore.jpg",
    ...NETWORK_CITY_IMAGES_BY_KEY.singapore,
  ],
  sentosa: ["/globe/singapore.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.singapore],
  operahouse: ["/globe/sydney.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.sydney],
  sydneyoperahouse: ["/globe/sydney.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.sydney],
  eiffeltower: ["/globe/paris.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.paris],
  bigben: ["/globe/london.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.london],
  towerbridge: ["/globe/london.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.london],
  shibuyacrossing: ["/globe/tokyo.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.tokyo],
  sensojitemple: ["/globe/tokyo.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.tokyo],
  colosseum: NETWORK_CITY_IMAGES_BY_KEY.rome,
};
const LOCAL_NAME_BY_KEY: Record<string, string> = {
  tokyo: "东京",
  singapore: "新加坡",
  sydney: "悉尼",
  london: "伦敦",
  paris: "巴黎",
  lyon: "里昂",
  marseille: "马赛",
  nice: "尼斯",
  newyork: "纽约",
  nyc: "纽约",
  beijing: "北京",
  sanfrancisco: "旧金山",
  sf: "旧金山",
  pisa: "比萨",
  rome: "罗马",
  kyoto: "京都",
  osaka: "大阪",
  dubai: "迪拜",
  bali: "巴厘岛",
  moscow: "莫斯科",
  istanbul: "伊斯坦布尔",
  melbourne: "墨尔本",
  hawaii: "夏威夷",
  egypt: "埃及",
  marinabaysands: "滨海湾金沙",
  eiffeltower: "埃菲尔铁塔",
  bigben: "大本钟",
  shibuyacrossing: "涩谷十字路口",
  sensojitemple: "浅草寺",
  operahouse: "悉尼歌剧院",
  sydneyoperahouse: "悉尼歌剧院",
  colosseum: "罗马斗兽场",
};
const DETAIL_SECTION_META: Record<
  DetailSectionId,
  { title: string; icon: string }
> = {
  attractions: { title: "热门景点", icon: "⌁" },
  food: { title: "必吃美食", icon: "♨" },
  stay: { title: "热门住宿区域", icon: "▥" },
  nightlife: { title: "夜生活", icon: "◐" },
};
const CITY_DETAIL_SAMPLES_BY_KEY: Record<
  string,
  Record<DetailSectionId, DetailSectionSample>
> = {
  tokyo: {
    attractions: {
      items: ["涩谷十字路口", "浅草寺", "东京晴空塔", "原宿表参道"],
      tip: "白天排浅草寺和晴空塔，傍晚到涩谷看城市灯光，动线更顺。",
      tags: ["地标", "街区", "夜景"],
    },
    food: {
      items: ["寿司店", "拉面小店", "居酒屋", "抹茶甜品"],
      tip: "热门拉面店尽量避开正餐尖峰，居酒屋适合放在夜间。",
      tags: ["日料", "小店", "夜宵"],
    },
    stay: {
      items: ["新宿", "银座", "上野浅草", "涩谷"],
      tip: "第一次来优先新宿或银座，交通和餐饮选择最稳。",
      tags: ["地铁便利", "购物", "夜生活"],
    },
    nightlife: {
      items: ["新宿黄金街", "涩谷夜景", "东京塔夜景", "台场海滨"],
      tip: "夜景点和餐厅预约放在同一区域，避免末班车压力。",
      tags: ["夜景", "酒吧", "散步"],
    },
  },
  singapore: {
    attractions: {
      items: ["滨海湾金沙", "滨海湾花园", "圣淘沙", "牛车水"],
      tip: "滨海湾花园和金沙适合连在同一天，晚上看灯光秀。",
      tags: ["海湾", "亲子", "夜景"],
    },
    food: {
      items: ["海南鸡饭", "叻沙", "辣椒螃蟹", "咖椰吐司"],
      tip: "小贩中心适合午餐，海鲜餐厅建议提前订位。",
      tags: ["小贩中心", "海鲜", "早餐"],
    },
    stay: {
      items: ["滨海湾", "乌节路", "牛车水", "克拉码头"],
      tip: "想看景选滨海湾，想购物和移动方便选乌节路。",
      tags: ["景观", "购物", "地铁"],
    },
    nightlife: {
      items: ["克拉码头", "金沙灯光秀", "滨海湾步道", "屋顶酒吧"],
      tip: "晚饭后沿滨海湾步行，照片和交通都更舒服。",
      tags: ["酒吧", "灯光秀", "河岸"],
    },
  },
  sydney: {
    attractions: {
      items: ["悉尼歌剧院", "海港大桥", "邦迪海滩", "岩石区"],
      tip: "歌剧院和岩石区适合半日步行，傍晚补海港夜景。",
      tags: ["海港", "海滩", "地标"],
    },
    food: {
      items: ["海鲜拼盘", "澳式早午餐", "肉派", "精品咖啡"],
      tip: "海港附近吃景观餐，市区咖啡店适合放在上午。",
      tags: ["海鲜", "咖啡", "早午餐"],
    },
    stay: {
      items: ["Circular Quay", "Darling Harbour", "Surry Hills", "Bondi"],
      tip: "第一次来选 Circular Quay 或 Darling Harbour，步行可达核心景点。",
      tags: ["海港", "市中心", "海滩"],
    },
    nightlife: {
      items: [
        "Darling Harbour",
        "The Rocks 酒吧",
        "歌剧院夜景",
        "Surry Hills 小酒馆",
      ],
      tip: "海港夜景和晚餐可以连起来，夜间回程也方便。",
      tags: ["海港夜景", "酒吧", "音乐"],
    },
  },
  london: {
    attractions: {
      items: ["大本钟", "伦敦塔桥", "大英博物馆", "考文特花园"],
      tip: "西敏寺区域适合白天走，塔桥和泰晤士河适合傍晚。",
      tags: ["历史", "博物馆", "河岸"],
    },
    food: {
      items: ["英式早餐", "炸鱼薯条", "下午茶", "Borough Market"],
      tip: "下午茶提前预约，市集更适合安排午餐或轻食。",
      tags: ["下午茶", "市集", "经典"],
    },
    stay: {
      items: ["Westminster", "Covent Garden", "South Bank", "King's Cross"],
      tip: "想省通勤选 Covent Garden 或 South Bank，交通和餐饮密度高。",
      tags: ["地铁", "剧院", "河岸"],
    },
    nightlife: {
      items: ["West End 音乐剧", "Soho 酒吧", "泰晤士河夜景", "Sky Garden"],
      tip: "音乐剧和晚餐要留足入场时间，热门场次提前订。",
      tags: ["剧院", "酒吧", "夜景"],
    },
  },
  paris: {
    attractions: {
      items: ["埃菲尔铁塔", "卢浮宫", "蒙马特", "塞纳河游船"],
      tip: "卢浮宫建议预约早场，傍晚留给铁塔和塞纳河。",
      tags: ["艺术", "河岸", "浪漫"],
    },
    food: {
      items: ["可颂", "法式甜点", "小酒馆", "奶酪与葡萄酒"],
      tip: "甜品和咖啡适合穿插在步行街区，不必单独绕路。",
      tags: ["甜品", "酒馆", "咖啡"],
    },
    stay: {
      items: ["卢浮宫周边", "玛黑区", "圣日耳曼", "歌剧院区"],
      tip: "第一次来优先 1-6 区，步行和地铁都更轻松。",
      tags: ["中心区", "艺术", "购物"],
    },
    nightlife: {
      items: ["塞纳河夜游", "蒙马特夜景", "爵士酒吧", "歌剧院周边"],
      tip: "夜游和晚餐安排在同一岸边，减少夜间换乘。",
      tags: ["夜游", "音乐", "观景"],
    },
  },
  newyork: {
    attractions: {
      items: ["时代广场", "中央公园", "布鲁克林大桥", "大都会艺术博物馆"],
      tip: "曼哈顿中城和中央公园适合一天，布鲁克林大桥留给傍晚。",
      tags: ["地标", "博物馆", "天际线"],
    },
    food: {
      items: ["纽约披萨", "贝果", "芝士蛋糕", "熟食店三明治"],
      tip: "经典小吃可以当作步行补给，正餐再安排预约餐厅。",
      tags: ["街头小吃", "甜品", "经典"],
    },
    stay: {
      items: ["Midtown", "Chelsea", "Long Island City", "Williamsburg"],
      tip: "想省通勤住 Midtown，想控制预算可看 Long Island City。",
      tags: ["地铁", "市中心", "预算"],
    },
    nightlife: {
      items: ["百老汇夜场", "DUMBO 夜景", "爵士俱乐部", "屋顶酒吧"],
      tip: "百老汇和屋顶酒吧都建议提前订，避免临时排队。",
      tags: ["演出", "酒吧", "夜景"],
    },
  },
  beijing: {
    attractions: {
      items: ["故宫", "天坛", "颐和园", "慕田峪长城"],
      tip: "故宫和景山适合同一天，长城单独留一整段时间。",
      tags: ["历史", "宫殿", "长城"],
    },
    food: {
      items: ["北京烤鸭", "炸酱面", "铜锅涮肉", "豆汁焦圈"],
      tip: "烤鸭和涮肉适合正餐，胡同小吃适合边逛边试。",
      tags: ["京味", "胡同", "正餐"],
    },
    stay: {
      items: ["王府井", "前门", "三里屯", "鼓楼什刹海"],
      tip: "看历史景点选前门或王府井，夜生活选三里屯。",
      tags: ["地铁", "历史", "夜生活"],
    },
    nightlife: {
      items: ["什刹海", "三里屯", "国贸夜景", "前门夜游"],
      tip: "夜游尽量靠近住宿区域，冬季注意室外停留时间。",
      tags: ["胡同", "酒吧", "城市夜景"],
    },
  },
  sanfrancisco: {
    attractions: {
      items: ["金门大桥", "渔人码头", "九曲花街", "联合广场"],
      tip: "金门大桥和海湾视角适合白天，联合广场可接晚餐。",
      tags: ["海湾", "桥", "街区"],
    },
    food: {
      items: ["酸面包", "海鲜浓汤", "墨西哥卷饼", "精品咖啡"],
      tip: "渔人码头吃海鲜，Mission 区适合找卷饼和咖啡。",
      tags: ["海鲜", "咖啡", "街区"],
    },
    stay: {
      items: ["Union Square", "Fisherman's Wharf", "SoMa", "Nob Hill"],
      tip: "第一次来住 Union Square 更好移动，海景需求看 Fisherman's Wharf。",
      tags: ["市中心", "海湾", "交通"],
    },
    nightlife: {
      items: ["北滩酒吧", "Mission 夜生活", "海湾夜景", "爵士现场"],
      tip: "夜间跨区移动建议提前规划交通，保持路线简短。",
      tags: ["酒吧", "音乐", "夜景"],
    },
  },
  pisa: {
    attractions: {
      items: ["比萨斜塔", "奇迹广场", "比萨主教座堂", "阿诺河岸"],
      tip: "核心景点集中在奇迹广场，适合半日游或顺路停留。",
      tags: ["地标", "广场", "教堂"],
    },
    food: {
      items: ["托斯卡纳面包", "意式冰淇淋", "手工意面", "当地葡萄酒"],
      tip: "景点周边用餐偏旅游化，可以往河岸和老城里走几条街。",
      tags: ["托斯卡纳", "甜品", "葡萄酒"],
    },
    stay: {
      items: ["奇迹广场附近", "中央车站周边", "阿诺河岸", "老城区"],
      tip: "短停选车站附近，慢游选老城或河岸。",
      tags: ["短停", "步行", "老城"],
    },
    nightlife: {
      items: ["阿诺河夜景", "老城酒吧", "大学区小馆", "广场散步"],
      tip: "比萨夜生活轻松安静，适合安排晚餐后散步。",
      tags: ["散步", "小酒馆", "河岸"],
    },
  },
};
const CITY_SAMPLE_ALIAS_BY_KEY: Record<string, string> = {
  nyc: "newyork",
  sf: "sanfrancisco",
  marinabaysands: "singapore",
  gardensbythebay: "singapore",
  sentosa: "singapore",
  operahouse: "sydney",
  sydneyoperahouse: "sydney",
  eiffeltower: "paris",
  bigben: "london",
  towerbridge: "london",
  shibuyacrossing: "tokyo",
  sensojitemple: "tokyo",
};
const DETAIL_ITEM_MEDIA_BY_TITLE: Record<string, DetailItemMedia> = {
  比萨斜塔: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/The_Leaning_Tower_of_Pisa%2C_Pisa%2C_Italy.jpg/960px-The_Leaning_Tower_of_Pisa%2C_Pisa%2C_Italy.jpg",
    description:
      "比萨最具识别度的钟楼，适合安排在奇迹广场主线里，白天拍照效果最好。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:The_Leaning_Tower_of_Pisa,_Pisa,_Italy.jpg",
  },
  奇迹广场: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Piazza_dei_Miracoli_%28Pisa%29_2023.1.jpg/960px-Piazza_dei_Miracoli_%28Pisa%29_2023.1.jpg",
    description: "比萨主教座堂、洗礼堂和斜塔所在的核心广场，适合集中半日游。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Piazza_dei_Miracoli_(Pisa)_2023.1.jpg",
  },
  比萨主教座堂: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Pisa_-_Cathedral_-_Facade_1052.jpg/960px-Pisa_-_Cathedral_-_Facade_1052.jpg",
    description: "奇迹广场内的罗曼式主教座堂，和斜塔、洗礼堂一起看最完整。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Pisa_-_Cathedral_-_Facade_1052.jpg",
  },
  阿诺河岸: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Pisa_Arno_03.jpg/960px-Pisa_Arno_03.jpg",
    description: "比萨老城里的河岸步行线，适合从景点区慢慢走回餐厅和小店。",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pisa_Arno_03.jpg",
  },
  托斯卡纳面包: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Pane_toscano.jpg/960px-Pane_toscano.jpg",
    description: "托斯卡纳传统无盐面包，适合配火腿、橄榄油或当地炖菜一起尝。",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pane_toscano.jpg",
  },
  意式冰淇淋: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Gelato%2C_Florence%2C_Italy_2016.jpg/960px-Gelato%2C_Florence%2C_Italy_2016.jpg",
    description:
      "意大利 gelato 适合放在下午散步时段，轻松补糖，也很适合边走边吃。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Gelato,_Florence,_Italy_2016.jpg",
  },
  手工意面: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Handmade_pasta_noodles_%28Unsplash%29.jpg/960px-Handmade_pasta_noodles_%28Unsplash%29.jpg",
    description: "手工意面更适合作为正餐，搭配托斯卡纳肉酱或简单番茄酱都很稳。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Handmade_pasta_noodles_(Unsplash).jpg",
  },
  当地葡萄酒: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Tuscan_Wine_Country_Vineyard_%2853593605746%29.jpg/960px-Tuscan_Wine_Country_Vineyard_%2853593605746%29.jpg",
    description:
      "托斯卡纳葡萄酒适合晚餐搭配，想轻松一点可以选按杯供应的小酒馆。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Tuscan_Wine_Country_Vineyard_(53593605746).jpg",
  },
  奇迹广场附近: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Piazza_dei_miracoli_-_aerial_panorama.jpg/960px-Piazza_dei_miracoli_-_aerial_panorama.jpg",
    description:
      "住在奇迹广场附近最方便早晚错峰拍斜塔，适合短停和第一次来比萨。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Piazza_dei_miracoli_-_aerial_panorama.jpg",
  },
  中央车站周边: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Pisa_Centrale_train_station_-_platforms.jpg/960px-Pisa_Centrale_train_station_-_platforms.jpg",
    description:
      "Pisa Centrale 周边适合赶火车或一晚短住，去佛罗伦萨、卢卡都方便。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Pisa_Centrale_train_station_-_platforms.jpg",
  },
  老城区: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Borgo_Stretto_de_Pisa.JPG/960px-Borgo_Stretto_de_Pisa.JPG",
    description: "老城区街巷更有生活感，适合慢游、找小餐馆和晚上散步。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Borgo_Stretto_de_Pisa.JPG",
  },
  阿诺河夜景: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Pisa_-_Arno_di_notte.JPG/960px-Pisa_-_Arno_di_notte.JPG",
    description: "阿诺河夜间灯光柔和，适合晚饭后散步，把节奏放慢一点。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Pisa_-_Arno_di_notte.JPG",
  },
  老城酒吧: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Borgo_Stretto_de_Pisa.JPG/960px-Borgo_Stretto_de_Pisa.JPG",
    description: "老城酒吧和小馆集中在步行街附近，适合晚餐后短距离探索。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Borgo_Stretto_de_Pisa.JPG",
  },
  大学区小馆: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Piazza_dei_Cavalieri_%28Pisa%29.jpg/960px-Piazza_dei_Cavalieri_%28Pisa%29.jpg",
    description: "骑士广场周边有大学氛围，小馆和咖啡店适合轻松收尾。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Piazza_dei_Cavalieri_(Pisa).jpg",
  },
  广场散步: {
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Piazza_dei_Cavalieri_%28Pisa%29.jpg/960px-Piazza_dei_Cavalieri_%28Pisa%29.jpg",
    description: "比萨广场夜间人少一些，适合饭后散步和补几张城市氛围照片。",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Piazza_dei_Cavalieri_(Pisa).jpg",
  },
};
const SCRIPT_ID = "viza-travel-google-maps-script";
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let mapsLoaderPromise: Promise<GoogleMapsNamespace> | null = null;
const markerIconCache = new Map<string, Promise<string>>();

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resolveMarkerImageUrl(imageSrc: string): string {
  if (!imageSrc) return "";
  if (/^https?:\/\//i.test(imageSrc) || imageSrc.startsWith("data:")) {
    return imageSrc;
  }
  if (imageSrc.startsWith("/")) {
    return `${window.location.origin}${imageSrc}`;
  }
  return imageSrc;
}

function normalizeLookupKey(input: string | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getImageLookupKey(imageSrc: string | undefined): string {
  if (!imageSrc) return "";
  return normalizeLookupKey(
    imageSrc
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "")
  );
}

function getPointLookupKeys(point: TripMapPoint): string[] {
  return Array.from(
    new Set(
      [
        point.label,
        point.city,
        point.localName,
        point.subtitle,
        getImageLookupKey(point.imageSrc),
      ]
        .map(normalizeLookupKey)
        .filter(Boolean)
    )
  );
}

function getLocalNameFromValue(value: string | undefined): string | null {
  const key = normalizeLookupKey(value);
  return key ? (LOCAL_NAME_BY_KEY[key] ?? null) : null;
}

function getPointDisplayName(point: TripMapPoint): string {
  if (point.kind !== "city") {
    const labelLocalName = getLocalNameFromValue(point.label);
    if (labelLocalName) return labelLocalName;
    const label = point.label.trim();
    if (label) return label;
    return point.localName ?? point.city ?? point.subtitle;
  }

  const cityLocalName = getLocalNameFromValue(point.city);
  if (cityLocalName) return cityLocalName;
  if (point.city) return point.localName ?? point.city;
  const labelLocalName = getLocalNameFromValue(point.label);
  if (labelLocalName) return labelLocalName;
  if (point.kind === "city" && point.localName) return point.localName;
  if (
    point.kind !== "city" &&
    point.localName &&
    point.localName !== point.city
  ) {
    return point.localName;
  }
  return point.label;
}

function formatChineseDuration(duration: string | undefined): string {
  const normalized = (duration ?? "2-4 days")
    .replace(/\brecommended\b/gi, "")
    .replace(/\bdays?\b/gi, "天")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || "2-4 天";
}

function getPointGalleryImages(point: TripMapPoint): string[] {
  const orderedImages: string[] = [point.imageSrc];
  const cityImage = getTravelCityImage(point.city ?? point.label);
  if (cityImage) orderedImages.push(cityImage);
  orderedImages.push(
    ...getTravelAttractionsForCity(point.city ?? point.label).map(
      (item) => item.imageSrc
    )
  );
  getPointLookupKeys(point).forEach((key) => {
    orderedImages.push(
      ...(GALLERY_IMAGES_BY_KEY[key] ?? []).filter((imageSrc) =>
        imageSrc.startsWith("/")
      )
    );
  });

  const uniqueImages = Array.from(new Set(orderedImages.filter(Boolean)));
  return Array.from(new Set(uniqueImages)).slice(0, GALLERY_MAX_IMAGES);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeLongitude(value: number): number {
  let longitude = value;
  while (longitude > 180) longitude -= 360;
  while (longitude < -180) longitude += 360;
  return longitude;
}

function interpolateGreatCirclePoint(
  start: GoogleLatLngLiteral,
  end: GoogleLatLngLiteral,
  progress: number
): GoogleLatLngLiteral {
  const safeProgress = clamp(progress, 0, 1);
  const startLat = toRadians(start.lat);
  const startLng = toRadians(start.lng);
  const endLat = toRadians(end.lat);
  const endLng = toRadians(end.lng);
  const deltaLat = endLat - startLat;
  const deltaLng = endLng - startLng;
  const angularDistance =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(deltaLat / 2) ** 2 +
          Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2
      )
    );

  if (!Number.isFinite(angularDistance) || angularDistance < 1e-9) {
    return {
      lat: start.lat + (end.lat - start.lat) * safeProgress,
      lng: normalizeLongitude(start.lng + (end.lng - start.lng) * safeProgress),
    };
  }

  const startWeight =
    Math.sin((1 - safeProgress) * angularDistance) / Math.sin(angularDistance);
  const endWeight =
    Math.sin(safeProgress * angularDistance) / Math.sin(angularDistance);
  const x =
    startWeight * Math.cos(startLat) * Math.cos(startLng) +
    endWeight * Math.cos(endLat) * Math.cos(endLng);
  const y =
    startWeight * Math.cos(startLat) * Math.sin(startLng) +
    endWeight * Math.cos(endLat) * Math.sin(endLng);
  const z = startWeight * Math.sin(startLat) + endWeight * Math.sin(endLat);

  return {
    lat: toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lng: normalizeLongitude(toDegrees(Math.atan2(y, x))),
  };
}

function interpolateRoutePath(
  routePath: GoogleLatLngLiteral[],
  progress: number
): GoogleLatLngLiteral[] {
  if (routePath.length < 2) return routePath;

  const safeProgress = clamp(progress, 0, 1);
  const segmentProgress = safeProgress * (routePath.length - 1);
  const completedSegments = Math.floor(segmentProgress);
  const partialProgress = segmentProgress - completedSegments;
  const visiblePath = routePath.slice(
    0,
    Math.min(completedSegments + 1, routePath.length)
  );

  if (completedSegments < routePath.length - 1) {
    const start = routePath[completedSegments]!;
    const end = routePath[completedSegments + 1]!;
    visiblePath.push(interpolateGreatCirclePoint(start, end, partialProgress));
  }

  return visiblePath;
}

function toWorldPixel(
  lat: number,
  lng: number,
  zoom: number
): { x: number; y: number } {
  const safeLat = clamp(lat, -MAX_VISIBLE_LAT, MAX_VISIBLE_LAT);
  const sinLat = Math.sin((safeLat * Math.PI) / 180);
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function worldPixelYToLat(y: number, zoom: number): number {
  const scale = 256 * Math.pow(2, zoom);
  const mercatorN = Math.PI - (2 * Math.PI * y) / scale;
  return (Math.atan(Math.sinh(mercatorN)) * 180) / Math.PI;
}

function getLatitudeBoundedCenter(
  center: GoogleLatLngLiteral,
  zoom: number,
  mapHeight: number
): GoogleLatLngLiteral {
  if (mapHeight <= 0) return center;

  const centerWorld = toWorldPixel(center.lat, center.lng, zoom);
  const topLimitY = toWorldPixel(MAX_VISIBLE_LAT, 0, zoom).y;
  const bottomLimitY = toWorldPixel(-MAX_VISIBLE_LAT, 0, zoom).y;
  const halfHeight = mapHeight / 2;
  const minCenterY = topLimitY + halfHeight;
  const maxCenterY = bottomLimitY - halfHeight;
  const nextCenterY =
    minCenterY > maxCenterY
      ? (minCenterY + maxCenterY) / 2
      : clamp(centerWorld.y, minCenterY, maxCenterY);

  if (Math.abs(nextCenterY - centerWorld.y) < 0.5) return center;

  return {
    lat: worldPixelYToLat(nextCenterY, zoom),
    lng: center.lng,
  };
}

function getContainerAwareMinZoom(mapHeight: number): number {
  if (mapHeight <= 0) return MIN_ZOOM;
  const requiredZoom = Math.ceil(Math.log2((mapHeight + 2) / 256));
  return Math.max(MIN_ZOOM, requiredZoom);
}

function getWrappedLongitudeNearCenter(lng: number, centerLng: number): number {
  let wrappedLng = lng;
  while (wrappedLng - centerLng > 180) wrappedLng -= 360;
  while (centerLng - wrappedLng > 180) wrappedLng += 360;
  return wrappedLng;
}

function toScreenPixel(
  lat: number,
  lng: number,
  center: GoogleLatLngLiteral,
  zoom: number,
  mapWidth: number,
  mapHeight: number
): { x: number; y: number } {
  const centerWorld = toWorldPixel(center.lat, center.lng, zoom);
  const world = toWorldPixel(
    lat,
    getWrappedLongitudeNearCenter(lng, center.lng),
    zoom
  );
  return {
    x: mapWidth / 2 + (world.x - centerWorld.x),
    y: mapHeight / 2 + (world.y - centerWorld.y),
  };
}

function getPointPriority(
  point: TripMapPoint,
  activePointId: string | null
): number {
  if (point.id === activePointId) return 0;
  if (point.kind === "city") return 1;
  if (point.kind === "hotel") return 2;
  if (point.kind === "hotspot") return 3;
  return 4;
}

function getDeclutteredPoints(
  points: TripMapPoint[],
  center: GoogleLatLngLiteral,
  zoom: number,
  mapWidth: number,
  mapHeight: number,
  iconSize: number,
  activePointId: string | null
): TripMapPoint[] {
  if (points.length <= 1) return points;

  const minDistance = clamp(iconSize * (zoom <= 3 ? 1.05 : 0.82), 42, 78);
  const rankedPoints = points
    .map((point, index) => ({
      point,
      index,
      screen: toScreenPixel(
        point.lat,
        point.lng,
        center,
        zoom,
        mapWidth,
        mapHeight
      ),
      priority: getPointPriority(point, activePointId),
    }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index);

  const accepted: typeof rankedPoints = [];
  rankedPoints.forEach((candidate) => {
    const shouldKeep =
      candidate.point.id === activePointId ||
      accepted.every((entry) => {
        const dx = entry.screen.x - candidate.screen.x;
        const dy = entry.screen.y - candidate.screen.y;
        return Math.hypot(dx, dy) >= minDistance;
      });

    if (shouldKeep) accepted.push(candidate);
  });

  return accepted.sort((a, b) => a.index - b.index).map((entry) => entry.point);
}

function getAdaptiveIconSize(
  pointCount: number,
  mapWidth: number,
  mapHeight: number
): number {
  const minDim = Math.max(320, Math.min(mapWidth, mapHeight));
  const base = minDim / 11;
  const densityFactor = clamp(1 - Math.max(0, pointCount - 4) * 0.07, 0.52, 1);
  return clamp(Math.round(base * densityFactor), ICON_MIN_SIZE, ICON_MAX_SIZE);
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function createBubbleMarkerDimensions(iconSize: number, isActive: boolean) {
  const bodySize = isActive ? Math.round(iconSize * 1.08) : iconSize;
  const tailHeight = Math.round(bodySize * 0.26);
  const width = bodySize + 10;
  const height = bodySize + tailHeight + 10;
  const strokeColor = isActive ? "#1d4ed8" : "#dbeafe";
  const strokeWidth = isActive ? 3 : 2;
  const borderRadius = Math.round(bodySize * 0.24);
  const tailHalf = Math.max(6, Math.round(bodySize * 0.11));
  const bubbleBottom = bodySize + 6;

  return {
    bodySize,
    tailHeight,
    width,
    height,
    strokeColor,
    strokeWidth,
    borderRadius,
    tailHalf,
    bubbleBottom,
  };
}

function createBubblePath(
  ctx: CanvasRenderingContext2D,
  dims: ReturnType<typeof createBubbleMarkerDimensions>
): void {
  drawRoundedRectPath(
    ctx,
    3,
    3,
    dims.bodySize + 4,
    dims.bodySize + 4,
    dims.borderRadius + 3
  );
  ctx.moveTo(Math.round(dims.width / 2) - dims.tailHalf, dims.bubbleBottom);
  ctx.lineTo(Math.round(dims.width / 2) + dims.tailHalf, dims.bubbleBottom);
  ctx.lineTo(Math.round(dims.width / 2), dims.bubbleBottom + dims.tailHeight);
  ctx.closePath();
}

function createSolidBubbleMarkerDataUrl(
  point: TripMapPoint,
  iconSize: number,
  isActive: boolean
): string {
  if (typeof document === "undefined") {
    return resolveMarkerImageUrl(point.imageSrc);
  }

  const dims = createBubbleMarkerDimensions(iconSize, isActive);
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(dims.width * dpr);
  canvas.height = Math.ceil(dims.height * dpr);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return resolveMarkerImageUrl(point.imageSrc);
  }

  ctx.scale(dpr, dpr);
  ctx.fillStyle = isActive ? "#3b82f6" : "#60a5fa";
  createBubblePath(ctx, dims);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 14px 'Segoe UI', 'Microsoft YaHei', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fallbackText = getPointDisplayName(point).trim().slice(0, 1) || "?";
  ctx.fillText(
    fallbackText,
    Math.round(dims.width / 2),
    Math.round((dims.bodySize + 8) / 2)
  );

  return canvas.toDataURL("image/png");
}

function loadImageForCanvas(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`marker image load failed: ${imageUrl}`));
    image.src = imageUrl;
  });
}

async function createBubbleMarkerDataUrl(
  point: TripMapPoint,
  iconSize: number,
  isActive: boolean
): Promise<string> {
  if (typeof document === "undefined") {
    return resolveMarkerImageUrl(point.imageSrc);
  }

  const imageUrl = resolveMarkerImageUrl(point.imageSrc);
  if (!imageUrl) {
    return createSolidBubbleMarkerDataUrl(point, iconSize, isActive);
  }

  try {
    const image = await loadImageForCanvas(imageUrl);
    const dims = createBubbleMarkerDimensions(iconSize, isActive);
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(dims.width * dpr);
    canvas.height = Math.ceil(dims.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return imageUrl;
    }

    ctx.scale(dpr, dpr);

    ctx.save();
    ctx.shadowColor = "rgba(15,23,42,0.26)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    createBubblePath(ctx, dims);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    drawRoundedRectPath(
      ctx,
      3,
      3,
      dims.bodySize + 4,
      dims.bodySize + 4,
      dims.borderRadius + 3
    );
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = dims.strokeWidth;
    ctx.strokeStyle = dims.strokeColor;
    ctx.stroke();

    const imageInset = 5;
    const imageSize = dims.bodySize;
    ctx.save();
    drawRoundedRectPath(
      ctx,
      imageInset,
      imageInset,
      imageSize,
      imageSize,
      dims.borderRadius
    );
    ctx.clip();
    ctx.drawImage(image, imageInset, imageInset, imageSize, imageSize);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(Math.round(dims.width / 2) - dims.tailHalf, dims.bubbleBottom);
    ctx.lineTo(Math.round(dims.width / 2) + dims.tailHalf, dims.bubbleBottom);
    ctx.lineTo(Math.round(dims.width / 2), dims.bubbleBottom + dims.tailHeight);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = dims.strokeWidth;
    ctx.strokeStyle = dims.strokeColor;
    ctx.stroke();

    return canvas.toDataURL("image/png");
  } catch {
    return createSolidBubbleMarkerDataUrl(point, iconSize, isActive);
  }
}

function getBubbleMarkerDataUrl(
  point: TripMapPoint,
  iconSize: number,
  isActive: boolean
): Promise<string> {
  const cacheKey = `${resolveMarkerImageUrl(point.imageSrc)}::${iconSize}::${isActive ? "1" : "0"}`;
  const cached = markerIconCache.get(cacheKey);
  if (cached) return cached;

  const promise = createBubbleMarkerDataUrl(point, iconSize, isActive);
  markerIconCache.set(cacheKey, promise);
  return promise;
}

function buildMarkerIcon(
  maps: GoogleMapsNamespace,
  point: TripMapPoint,
  isActive: boolean,
  iconSize: number,
  markerDataUrl: string
): GoogleMapMarkerIcon {
  const dims = createBubbleMarkerDimensions(iconSize, isActive);

  return {
    url: markerDataUrl,
    scaledSize: new maps.Size(dims.width, dims.height),
    anchor: new maps.Point(Math.round(dims.width / 2), dims.height - 2),
    labelOrigin: new maps.Point(Math.round(dims.width / 2), dims.height + 11),
  };
}

function calculateCoordinateCenter(
  coordinates: GoogleLatLngLiteral[]
): GoogleLatLngLiteral {
  if (!coordinates.length) return DEFAULT_CENTER;

  const totals = coordinates.reduce(
    (sum, point) => ({
      lat: sum.lat + point.lat,
      lng: sum.lng + point.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: totals.lat / coordinates.length,
    lng: totals.lng / coordinates.length,
  };
}

function estimateCoordinateZoom(
  coordinates: GoogleLatLngLiteral[],
  mapWidth: number,
  mapHeight: number
): number {
  if (coordinates.length <= 1) return 6;

  const lats = coordinates.map((point) => point.lat);
  const lngs = coordinates.map((point) => point.lng);
  const latSpan = Math.max(0.7, Math.max(...lats) - Math.min(...lats));
  const lngSpan = Math.max(0.7, Math.max(...lngs) - Math.min(...lngs));
  const paddedLatSpan = latSpan * 1.45;
  const paddedLngSpan = lngSpan * 1.45;
  const lngZoom = Math.log2((mapWidth * 360) / (256 * paddedLngSpan));
  const latZoom = Math.log2((mapHeight * 170) / (256 * paddedLatSpan));
  const minimumFitZoom = latSpan > 100 || lngSpan > 120 ? MIN_ZOOM : 3;

  return Math.floor(clamp(Math.min(latZoom, lngZoom), minimumFitZoom, 11));
}

function getPointDisplayLocation(point: TripMapPoint): string {
  if (point.countryLabel)
    return point.countryLabel.replace(/\s*\([^)]*\)/g, "").trim();
  if (point.subtitle.includes(" in ")) {
    const subtitleLocation =
      point.subtitle.split(" in ").at(-1)?.trim() || point.subtitle;
    return getLocalNameFromValue(subtitleLocation) ?? subtitleLocation;
  }
  return (
    getLocalNameFromValue(point.city) ??
    getLocalNameFromValue(point.subtitle) ??
    point.localName ??
    point.city ??
    point.subtitle
  );
}

function getPointAttractions(point: TripMapPoint): string {
  const city =
    point.kind === "city"
      ? getPointDisplayName(point)
      : (getLocalNameFromValue(point.city) ??
        point.city ??
        getPointDisplayName(point));
  const curatedAttractions = getTravelAttractionsForCity(
    point.city ?? point.label
  )
    .slice(0, 4)
    .map((item) => item.name);
  if (point.kind === "city" && curatedAttractions.length) {
    return curatedAttractions.join("、");
  }

  const attractionName = getLocalNameFromValue(point.label) ?? point.label;
  const base =
    point.kind === "city"
      ? [`${city}经典地标`, `${city}热门街区`, "观景点", "夜市"]
      : [attractionName, `${city}步行路线`, "当地美食", "观景点", "夜景"];
  return Array.from(new Set(base)).join("、");
}

function formatGooglePointRating(
  point: TripMapPoint,
  isZh: boolean
): string | null {
  if (point.source !== "google" || typeof point.rating !== "number") return null;
  const count = Math.max(0, Math.round(point.reviewCount ?? 0)).toLocaleString();
  return isZh
    ? `${point.rating.toFixed(1)} 分 · ${count} 条评价`
    : `${point.rating.toFixed(1)} · ${count} reviews`;
}

function formatGooglePointAttribution(
  point: TripMapPoint,
  isZh: boolean
): string | null {
  if (point.source !== "google") return null;
  const names = point.attribution
    ?.map((item) => item.displayName?.trim())
    .filter((name): name is string => Boolean(name));
  if (!names?.length) return null;
  return `${isZh ? "照片：" : "Photo: "}${names.slice(0, 2).join(", ")}`;
}

function splitDetailItems(value: string): string[] {
  return value
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function getCityDetailSamples(
  point: TripMapPoint
): Record<DetailSectionId, DetailSectionSample> | null {
  const cityAttractions = getTravelAttractionsForCity(point.city ?? point.label)
    .slice(0, 4)
    .map((item) => item.name);
  const cityLabel =
    getLocalNameFromValue(point.city) ??
    point.city ??
    getPointDisplayName(point);

  for (const key of getPointLookupKeys(point)) {
    const sampleKey = CITY_SAMPLE_ALIAS_BY_KEY[key] ?? key;
    const samples = CITY_DETAIL_SAMPLES_BY_KEY[sampleKey];
    if (samples) {
      return cityAttractions.length
        ? {
            ...samples,
            attractions: {
              items: cityAttractions,
              tip: `${cityLabel}景点卡片已按真实位置和本地图片校准，可直接加入路线。`,
              tags: ["定位准确", "本地图片", "精选景点"],
            },
          }
        : samples;
    }
  }

  if (cityAttractions.length) {
    return {
      attractions: {
        items: cityAttractions,
        tip: `${cityLabel}景点卡片已按真实位置和本地图片校准，可直接加入路线。`,
        tags: ["定位准确", "本地图片", "精选景点"],
      },
      food: getFallbackDetailSample(point, "food", cityLabel, cityLabel),
      stay: getFallbackDetailSample(point, "stay", cityLabel, cityLabel),
      nightlife: getFallbackDetailSample(
        point,
        "nightlife",
        cityLabel,
        cityLabel
      ),
    };
  }

  return null;
}

function getFallbackDetailSample(
  point: TripMapPoint,
  sectionId: DetailSectionId,
  city: string,
  location: string
): DetailSectionSample {
  const attractionItems = splitDetailItems(getPointAttractions(point));

  if (sectionId === "attractions") {
    return {
      items: attractionItems,
      tip: `${city}景点建议按相邻区域组合，先排地标，再留时间给街区和观景点。`,
      tags: ["地标", "街区", "拍照"],
    };
  }

  if (sectionId === "food") {
    return {
      items: [`${city}当地小吃`, "招牌餐厅", "咖啡甜品", "夜市摊位"],
      tip: "把人气餐厅放在午晚餐，轻食和甜品穿插在步行路线里。",
      tags: ["小吃", "正餐", "甜品"],
    };
  }

  if (sectionId === "stay") {
    return {
      items: [`${location}核心区`, "地标街区", "交通枢纽附近", "安静住宅区"],
      tip: "优先选择靠近地铁或主要景点的区域，减少每天往返时间。",
      tags: ["交通", "核心区", "省时"],
    };
  }

  return {
    items: [`${city}夜景`, "河岸或海湾散步", "屋顶酒吧", "夜市街区"],
    tip: "夜间安排控制在同一区域内，晚餐、散步和回酒店会更顺。",
    tags: ["夜景", "酒吧", "散步"],
  };
}

function buildDetailSectionSample(
  point: TripMapPoint,
  sectionId: DetailSectionId,
  city: string,
  location: string
): DetailSectionSample {
  const citySamples = getCityDetailSamples(point);
  return (
    citySamples?.[sectionId] ??
    getFallbackDetailSample(point, sectionId, city, location)
  );
}

function getDetailSectionItemDescription(
  sectionId: DetailSectionId,
  item: string,
  city: string
): string {
  if (sectionId === "attractions") {
    return `${item}适合安排成${city}的打卡点，白天拍照、傍晚散步都很顺。`;
  }

  if (sectionId === "food") {
    return `${item}适合穿插在行程中间，作为轻松补给或晚间收尾。`;
  }

  if (sectionId === "stay") {
    return `${item}周边交通和餐饮更集中，适合作为年轻旅行者的落脚点。`;
  }

  return `${item}适合晚饭后体验，节奏轻一点，照片和氛围都会更好。`;
}

function getDetailItemMedia(
  sectionId: DetailSectionId,
  item: string,
  city: string
): DetailItemMedia {
  const attraction = findTravelAttraction(city, item);
  if (sectionId === "attractions" && attraction) {
    return {
      imageSrc: attraction.imageSrc,
      description:
        attraction.description ??
        getDetailSectionItemDescription(sectionId, item, city),
      sourceUrl: attraction.sourceUrl,
    };
  }

  return (
    DETAIL_ITEM_MEDIA_BY_TITLE[item] ?? {
      description: getDetailSectionItemDescription(sectionId, item, city),
    }
  );
}

function getPointIntro(point: TripMapPoint): string {
  return (
    point.intro ??
    `${getPointDisplayName(point)}适合安排紧凑半日到一日游，动线清晰，拍照点集中，也方便串联周边美食与夜景。`
  );
}

function buildHoverCardHtml(
  point: TripMapPoint,
  addButtonId: string | null,
  buttonLabel: string,
  isZh: boolean,
  options?: {
    cardWidth?: number;
    imageHeight?: number;
    compact?: boolean;
    previousPhotoButtonId?: string;
    photoButtonId?: string;
    summaryButtonId?: string;
    imageElementId?: string;
    dotIdPrefix?: string;
    galleryImages?: string[];
  }
): string {
  const title = getPointDisplayName(point);
  const cityOrCountry = getPointDisplayLocation(point);
  const attractions = getPointAttractions(point);
  const duration = isZh
    ? formatChineseDuration(point.recommendedDays)
    : (point.recommendedDays ?? "").trim();
  const googleRating = formatGooglePointRating(point, isZh);
  const googleAttribution = formatGooglePointAttribution(point, isZh);
  const googleMapsUri =
    point.source === "google" && point.googleMapsUri
      ? point.googleMapsUri
      : null;
  const galleryImages =
    options?.galleryImages && options.galleryImages.length > 0
      ? options.galleryImages
      : [resolveMarkerImageUrl(point.imageSrc)];
  const imageUrl = galleryImages[0] ?? "";
  const cardWidth = options?.cardWidth ?? 420;
  const imageHeight = options?.imageHeight ?? 260;
  const compact = options?.compact ?? false;
  const titleSize = compact ? 17 : 19;
  const bodySize = compact ? 12 : 13;
  const padding = compact ? 13 : 16;
  const previousPhotoButtonId = options?.previousPhotoButtonId;
  const photoButtonId = options?.photoButtonId;
  const summaryButtonId = options?.summaryButtonId;
  const imageElementId = options?.imageElementId;
  const dotIdPrefix = options?.dotIdPrefix;
  const introLineHeight = compact ? 19 : 21;
  const introHeight = introLineHeight * 2;
  const galleryButtonSize = compact ? 34 : 38;
  const galleryButtonStyle = `pointer-events:auto;position:absolute;top:50%;height:${galleryButtonSize}px;width:${galleryButtonSize}px;transform:translateY(-50%);border:0;border-radius:999px;background:#fff;color:#0f172a;font-size:${compact ? 27 : 30}px;font-weight:400;line-height:1;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(15,23,42,.18);`;

  return `
<div data-viza-trip-hover-card="true" style="box-sizing:border-box;width:${cardWidth}px;max-width:${cardWidth}px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;pointer-events:auto;">
  <div style="box-sizing:border-box;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 12px 28px rgba(15,23,42,.18);background:#fff;pointer-events:auto;">
    <div style="position:relative;height:${imageHeight}px;background:#e2e8f0;">
      <img ${imageElementId ? `id="${imageElementId}"` : ""} src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" style="display:block;width:100%;height:100%;object-fit:cover;" />
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(15,23,42,.03),rgba(15,23,42,.18));"></div>
      ${
        previousPhotoButtonId
          ? `<button id="${previousPhotoButtonId}" type="button" aria-label="${isZh ? "上一张照片" : "Previous photo"}" style="${galleryButtonStyle}left:12px;"><span style="display:block;line-height:1;transform:translateY(-1px);">‹</span></button>`
          : ""
      }
      ${
        photoButtonId
          ? `<button id="${photoButtonId}" type="button" aria-label="${isZh ? "下一张照片" : "Next photo"}" style="${galleryButtonStyle}right:12px;"><span style="display:block;line-height:1;transform:translateY(-1px);">›</span></button>`
          : ""
      }
      <div style="position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:center;gap:5px;">
        ${galleryImages
          .map(
            (_, index) =>
              `<span ${dotIdPrefix ? `id="${dotIdPrefix}-${index}"` : ""} style="height:5px;width:5px;border-radius:999px;background:rgba(255,255,255,${index === 0 ? ".96" : ".62"});"></span>`
          )
          .join("")}
      </div>
    </div>
    <div style="box-sizing:border-box;margin-top:-12px;position:relative;border-radius:12px 12px 0 0;background:#fff;padding:${padding}px ${padding}px ${padding + 2}px;">
      <div style="display:flex;align-items:center;gap:6px;font-size:${titleSize}px;font-weight:800;line-height:1.1;color:#020617;">
        <span>${escapeHtml(title)}</span>
        <span style="border-radius:6px;background:#fff1f2;color:#fb4d61;font-size:${compact ? 13 : 15}px;font-weight:800;padding:2px 5px;">🔥 10</span>
      </div>
      <button id="${summaryButtonId ?? ""}" type="button" style="pointer-events:auto;box-sizing:border-box;margin-top:10px;width:100%;border:0;border-radius:7px;background:#f1f0ff;padding:7px 8px;text-align:left;color:#0f3bae;cursor:pointer;font-size:${bodySize}px;line-height:${introLineHeight}px;min-height:${introHeight + 14}px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
        <span style="color:#0f3bae;">${isZh ? "热门景点：" : "Highlights:"}</span> <span style="color:#020617;">${escapeHtml(attractions)}</span>
      </button>
      ${
        googleRating || googleMapsUri
          ? `<div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:${bodySize}px;color:#475569;">
        ${
          googleRating
            ? `<span style="font-weight:700;color:#0f172a;">★ ${escapeHtml(googleRating)}</span>`
            : ""
        }
        ${
          googleMapsUri
            ? `<a href="${escapeHtml(googleMapsUri)}" target="_blank" rel="noreferrer" style="color:#0f3bae;text-decoration:none;font-weight:700;">${isZh ? "Google 地图" : "Google Maps"}</a>`
            : ""
        }
      </div>`
          : ""
      }
      <div style="margin-top:10px;display:flex;align-items:center;gap:7px;font-size:${bodySize}px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        <span style="font-size:${compact ? 14 : 16}px;color:#475569;">⌖</span>
        <span>${escapeHtml(cityOrCountry)}</span>
        <span style="height:13px;width:1px;background:#cbd5e1;"></span>
        <span>${escapeHtml(duration)} 推荐</span>
      </div>
      ${
        googleAttribution
          ? `<div style="margin-top:7px;font-size:${compact ? 11 : 12}px;line-height:1.4;color:#64748b;">${escapeHtml(googleAttribution)}</div>`
          : ""
      }
      ${
        addButtonId
          ? `<div style="margin-top:15px;">
        <button id="${addButtonId}" type="button" style="pointer-events:auto;width:100%;border:0;border-radius:7px;padding:${compact ? 10 : 12}px 10px;background:#3464f4;color:#fff;font-size:${compact ? 14 : 16}px;font-weight:500;cursor:pointer;">
          ${escapeHtml(buttonLabel)}
        </button>
      </div>`
          : ""
      }
    </div>
  </div>
</div>`;
}

function sanitizeDomId(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function loadGoogleMaps(apiKey: string): Promise<GoogleMapsNamespace> {
  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  }

  const existingMaps = window.google?.maps;
  if (existingMaps) return existingMaps;
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = new Promise<GoogleMapsNamespace>((resolve, reject) => {
    const resolveMaps = () => {
      const maps = window.google?.maps;
      if (maps) {
        resolve(maps);
        return;
      }
      reject(
        new Error(
          "Google Maps API loaded, but window.google.maps is unavailable"
        )
      );
    };

    const existingScript = document.getElementById(
      SCRIPT_ID
    ) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", resolveMaps, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Maps script")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=zh-CN&region=CN&v=weekly`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", resolveMaps, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load Google Maps script")),
      { once: true }
    );
    document.head.appendChild(script);
  }).catch((error) => {
    mapsLoaderPromise = null;
    throw error;
  });

  return mapsLoaderPromise;
}

export function TripRouteMap({
  points,
  routeCoordinates,
  activePointId,
  onPointSelect,
  onAddDestination,
  animateRoute,
  className,
}: TripRouteMapProps) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const hoverInfoRef = useRef<GoogleInfoWindowInstance | null>(null);
  const markersRef = useRef<
    Array<{
      marker: GoogleMarkerInstance;
      listeners: GoogleMarkerListener[];
      id: string;
      point: TripMapPoint;
    }>
  >([]);
  const layoutRerenderListenersRef = useRef<GoogleMarkerListener[]>([]);
  const routeLineRef = useRef<GooglePolylineInstance | null>(null);
  const animatedRouteLineRef = useRef<GooglePolylineInstance | null>(null);
  const routeAnimationFrameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const fittedOnceRef = useRef(false);
  const fitKeyRef = useRef<string>("");
  const onAddDestinationRef = useRef(onAddDestination);
  const onPointSelectRef = useRef(onPointSelect);
  const activePointIdRef = useRef(activePointId ?? null);
  const markerVisualVersionRef = useRef(0);
  const refreshMarkerVisualsRef = useRef<() => void>(() => {});
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailPointId, setDetailPointId] = useState<string | null>(null);
  const [expandedDetailSectionId, setExpandedDetailSectionId] =
    useState<DetailSectionId | null>(null);

  const pointKey = useMemo(
    () =>
      points.map((point) => `${point.id}:${point.lat}:${point.lng}`).join("|"),
    [points]
  );

  const routeKey = useMemo(
    () => routeCoordinates.map(([lat, lng]) => `${lat},${lng}`).join("|"),
    [routeCoordinates]
  );

  const activeFocusKey = useMemo(() => {
    if (!activePointId) return "";

    const activePoint = points.find((point) => point.id === activePointId);
    if (!activePoint) return "";

    return `${activePoint.id}:${activePoint.lat}:${activePoint.lng}:${activePoint.kind}:${routeKey}`;
  }, [activePointId, points, routeKey]);

  const detailPoint = useMemo(
    () => points.find((point) => point.id === detailPointId) ?? null,
    [detailPointId, points]
  );
  const detailGalleryImages = useMemo(
    () => (detailPoint ? getPointGalleryImages(detailPoint) : []),
    [detailPoint]
  );
  const detailGoogleRating = detailPoint
    ? formatGooglePointRating(detailPoint, isZh)
    : null;
  const detailGoogleAttribution = detailPoint
    ? formatGooglePointAttribution(detailPoint, isZh)
    : null;

  useEffect(() => {
    onAddDestinationRef.current = onAddDestination;
  }, [onAddDestination]);

  useEffect(() => {
    onPointSelectRef.current = onPointSelect;
  }, [onPointSelect]);

  useEffect(() => {
    activePointIdRef.current = activePointId ?? null;
  }, [activePointId]);

  const refreshMarkerVisuals = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    const visualVersion = markerVisualVersionRef.current + 1;
    markerVisualVersionRef.current = visualVersion;
    const mapWidth = containerRef.current?.clientWidth ?? 1200;
    const mapHeight = containerRef.current?.clientHeight ?? 800;
    const iconSize = getAdaptiveIconSize(
      markersRef.current.length,
      mapWidth,
      mapHeight
    );

    markersRef.current.forEach(({ marker, point }) => {
      const isActive = point.id === activePointIdRef.current;
      const fallbackMarkerUrl = createSolidBubbleMarkerDataUrl(
        point,
        iconSize,
        isActive
      );
      marker.setIcon(
        buildMarkerIcon(maps, point, isActive, iconSize, fallbackMarkerUrl)
      );
      marker.setLabel(undefined);
      marker.setZIndex(isActive ? 1000 : 100);

      void getBubbleMarkerDataUrl(point, iconSize, isActive).then(
        (markerDataUrl) => {
          const markerStillMounted = markersRef.current.some(
            (entry) => entry.marker === marker && entry.id === point.id
          );
          if (
            !markerStillMounted ||
            markerVisualVersionRef.current !== visualVersion
          ) {
            return;
          }

          marker.setIcon(
            buildMarkerIcon(maps, point, isActive, iconSize, markerDataUrl)
          );
        }
      );
    });
  }, []);

  useEffect(() => {
    refreshMarkerVisualsRef.current = refreshMarkerVisuals;
  }, [refreshMarkerVisuals]);

  useEffect(() => {
    if (!detailPointId) return;
    if (!points.some((point) => point.id === detailPointId)) {
      setDetailPointId(null);
    }
  }, [detailPointId, points]);

  useEffect(() => {
    setExpandedDetailSectionId(null);
  }, [detailPointId]);

  useEffect(() => {
    let disposed = false;
    let markerRefreshFrameId: number | null = null;

    void (async () => {
      if (!containerRef.current || mapRef.current) return;
      try {
        const maps = await loadGoogleMaps(GOOGLE_MAPS_API_KEY);
        if (disposed || !containerRef.current) return;

        mapsRef.current = maps;
        const initialMinZoom = getContainerAwareMinZoom(
          containerRef.current.clientHeight
        );
        const map = new maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: Math.max(DEFAULT_ZOOM, initialMinZoom),
          minZoom: initialMinZoom,
          maxZoom: 17,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          gestureHandling: "greedy",
          restriction: VERTICAL_MAP_RESTRICTION,
        });

        hoverInfoRef.current = new maps.InfoWindow({
          disableAutoPan: false,
        });

        mapRef.current = map;
        map.addListener("click", () => {
          hoverInfoRef.current?.close();
        });
        let centerClampRunning = false;
        let appliedMinZoom = initialMinZoom;
        const clampMapCenterLatitude = () => {
          if (centerClampRunning) return;
          const center = map.getCenter();
          if (!center) return;
          const minZoom = getContainerAwareMinZoom(
            containerRef.current?.clientHeight ?? 0
          );
          if (minZoom !== appliedMinZoom) {
            appliedMinZoom = minZoom;
            map.setOptions({
              minZoom,
              restriction: VERTICAL_MAP_RESTRICTION,
            });
          }
          if ((map.getZoom() ?? DEFAULT_ZOOM) < minZoom) {
            map.setZoom(minZoom);
          }
          const boundedCenter = getLatitudeBoundedCenter(
            { lat: center.lat(), lng: center.lng() },
            map.getZoom() ?? DEFAULT_ZOOM,
            containerRef.current?.clientHeight ?? 0
          );
          if (Math.abs(boundedCenter.lat - center.lat()) < 0.000001) return;

          centerClampRunning = true;
          map.setCenter(boundedCenter);
          window.setTimeout(() => {
            centerClampRunning = false;
          }, 0);
        };

        const scheduleMarkerVisualRefresh = () => {
          hoverInfoRef.current?.close();
          if (markerRefreshFrameId !== null) return;

          markerRefreshFrameId = window.requestAnimationFrame(() => {
            markerRefreshFrameId = null;
            refreshMarkerVisualsRef.current();
          });
        };
        const scheduleMapResize = () => {
          hoverInfoRef.current?.close();
          if (markerRefreshFrameId !== null) return;

          markerRefreshFrameId = window.requestAnimationFrame(() => {
            markerRefreshFrameId = null;
            maps.event.trigger(map, "resize");
            clampMapCenterLatitude();
            refreshMarkerVisualsRef.current();
          });
        };

        layoutRerenderListenersRef.current = [
          map.addListener("zoom_changed", () => {
            clampMapCenterLatitude();
            scheduleMarkerVisualRefresh();
          }),
          map.addListener("dragstart", () => {
            hoverInfoRef.current?.close();
          }),
          map.addListener("drag", clampMapCenterLatitude),
          map.addListener("bounds_changed", clampMapCenterLatitude),
          map.addListener("center_changed", clampMapCenterLatitude),
          map.addListener("idle", clampMapCenterLatitude),
        ];

        if (containerRef.current && typeof ResizeObserver !== "undefined") {
          const observer = new ResizeObserver(() => {
            scheduleMapResize();
          });
          observer.observe(containerRef.current);
          resizeObserverRef.current = observer;
        }

        [0, 240].forEach((delay) => {
          window.setTimeout(() => {
            maps.event.trigger(map, "resize");
            clampMapCenterLatitude();
            refreshMarkerVisualsRef.current();
          }, delay);
        });
        setLoadError(null);
        setIsReady(true);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to initialize Google Maps";
        setLoadError(message);
      }
    })();

    return () => {
      disposed = true;
      setIsReady(false);

      markersRef.current.forEach(({ marker, listeners }) => {
        listeners.forEach((listener) => listener.remove());
        marker.setMap(null);
      });
      markersRef.current = [];
      layoutRerenderListenersRef.current.forEach((listener) =>
        listener.remove()
      );
      layoutRerenderListenersRef.current = [];
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (markerRefreshFrameId !== null) {
        window.cancelAnimationFrame(markerRefreshFrameId);
        markerRefreshFrameId = null;
      }

      if (hoverInfoRef.current) {
        hoverInfoRef.current.close();
        hoverInfoRef.current = null;
      }

      if (routeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(routeAnimationFrameRef.current);
        routeAnimationFrameRef.current = null;
      }
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
      animatedRouteLineRef.current?.setMap(null);
      animatedRouteLineRef.current = null;

      mapRef.current = null;
      mapsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const map = mapRef.current;
    const maps = mapsRef.current;
    const hoverInfo = hoverInfoRef.current;
    if (!map || !maps || !hoverInfo) return;

    markersRef.current.forEach(({ marker, listeners }) => {
      listeners.forEach((listener) => listener.remove());
      marker.setMap(null);
    });
    markersRef.current = [];

    const zoom = map.getZoom() ?? DEFAULT_ZOOM;
    const mapWidth = containerRef.current?.clientWidth ?? 1200;
    const mapHeight = containerRef.current?.clientHeight ?? 800;
    const iconSize = getAdaptiveIconSize(points.length, mapWidth, mapHeight);
    let effectDisposed = false;
    let fitRetryTimeoutId: number | null = null;
    const fitFallbackTimeoutIds: number[] = [];

    const currentActivePointId = activePointIdRef.current;
    const currentCenter = map.getCenter();
    const visiblePoints = getDeclutteredPoints(
      points,
      currentCenter
        ? { lat: currentCenter.lat(), lng: currentCenter.lng() }
        : DEFAULT_CENTER,
      zoom,
      mapWidth,
      mapHeight,
      iconSize,
      currentActivePointId
    );

    visiblePoints.forEach((point) => {
      const isActive = point.id === currentActivePointId;
      const markerDimensions = createBubbleMarkerDimensions(iconSize, isActive);
      const fallbackMarkerUrl = createSolidBubbleMarkerDataUrl(
        point,
        iconSize,
        isActive
      );
      const marker = new maps.Marker({
        map,
        position: { lat: point.lat, lng: point.lng },
        title: `${point.label} · ${point.subtitle}`,
        icon: buildMarkerIcon(
          maps,
          point,
          isActive,
          iconSize,
          fallbackMarkerUrl
        ),
        shape: {
          coords: [0, 0, markerDimensions.width, markerDimensions.height],
          type: "rect",
        },
        optimized: false,
        zIndex: isActive ? 1000 : 100,
      });

      let previewPinned = false;
      let closePreviewTimer: number | null = null;
      let reopenPreviewTimer: number | null = null;
      const clearPreviewCloseTimer = () => {
        if (closePreviewTimer === null) return;
        window.clearTimeout(closePreviewTimer);
        closePreviewTimer = null;
      };
      const schedulePreviewClose = (delay = 140) => {
        clearPreviewCloseTimer();
        closePreviewTimer = window.setTimeout(() => {
          closePreviewTimer = null;
          hoverInfo.close();
        }, delay);
      };

      const openPreview = (pinned = false) => {
        if (effectDisposed) return;
        previewPinned = pinned;
        clearPreviewCloseTimer();
        const safePointId = sanitizeDomId(point.id);
        const buttonId = `trip-map-add-${safePointId}`;
        const previousPhotoButtonId = `trip-map-photo-prev-${safePointId}`;
        const photoButtonId = `trip-map-photo-${safePointId}`;
        const summaryButtonId = `trip-map-summary-${safePointId}`;
        const imageElementId = `trip-map-image-${safePointId}`;
        const dotIdPrefix = `trip-map-dot-${safePointId}`;
        const galleryImages = getPointGalleryImages(point).map(
          resolveMarkerImageUrl
        );
        const cityForPlan = getPointDisplayName(point);
        const currentWidth = containerRef.current?.clientWidth ?? mapWidth;
        const currentHeight = containerRef.current?.clientHeight ?? mapHeight;
        const currentZoom = map.getZoom() ?? zoom;
        const currentCenterValue = map.getCenter();
        const currentCenter = currentCenterValue
          ? { lat: currentCenterValue.lat(), lng: currentCenterValue.lng() }
          : DEFAULT_CENTER;
        const pixelPoint = toScreenPixel(
          point.lat,
          point.lng,
          currentCenter,
          currentZoom,
          currentWidth,
          currentHeight
        );
        const compact = currentWidth < 980 || currentHeight < 680;
        const cardWidth = clamp(
          compact ? 238 : 294,
          220,
          Math.max(220, currentWidth - 56)
        );
        const previewWidth = cardWidth;
        const imageHeight = compact ? 168 : 217;
        const estimatedCardHeight = imageHeight + (compact ? 190 : 220);

        let offsetX = 0;
        if (pixelPoint.x < currentWidth * 0.45) {
          offsetX = Math.round(cardWidth * 0.2);
        } else if (pixelPoint.x > currentWidth * 0.55) {
          offsetX = -Math.round(cardWidth * 0.2);
        }

        let offsetY =
          pixelPoint.y < estimatedCardHeight + 28
            ? Math.round(estimatedCardHeight * 0.72)
            : -12;

        const safeMargin = 12;
        const predictedLeft = pixelPoint.x - previewWidth / 2 + offsetX;
        const predictedRight = predictedLeft + previewWidth;
        const predictedTop = pixelPoint.y - estimatedCardHeight + offsetY;
        const predictedBottom = predictedTop + estimatedCardHeight;

        if (predictedLeft < safeMargin) {
          offsetX += Math.round(safeMargin - predictedLeft);
        } else if (predictedRight > currentWidth - safeMargin) {
          offsetX -= Math.round(predictedRight - (currentWidth - safeMargin));
        }

        if (predictedTop < safeMargin) {
          offsetY += Math.round(safeMargin - predictedTop);
        } else if (predictedBottom > currentHeight - safeMargin) {
          offsetY -= Math.round(predictedBottom - (currentHeight - safeMargin));
        }

        hoverInfo.setOptions({
          disableAutoPan: true,
          maxWidth: previewWidth,
          pixelOffset: new maps.Size(offsetX, offsetY),
        });
        hoverInfo.setContent(
          buildHoverCardHtml(
            point,
            onAddDestinationRef.current ? buttonId : null,
            isZh
              ? `加入我的计划：${cityForPlan}`
              : `Add to my plan: ${cityForPlan}`,
            isZh,
            {
              cardWidth,
              imageHeight,
              compact,
              previousPhotoButtonId,
              photoButtonId,
              summaryButtonId,
              imageElementId,
              dotIdPrefix,
              galleryImages,
            }
          )
        );
        hoverInfo.open({
          map,
          anchor: marker,
          shouldFocus: false,
        });

        maps.event.addListenerOnce(hoverInfo as unknown, "domready", () => {
          const polishPreviewChrome = () => {
            const mapElement = containerRef.current;
            const infoElement = mapElement?.querySelector<HTMLElement>(
              ".gm-style-iw.gm-style-iw-c"
            );
            if (!infoElement) return;

            infoElement.style.background = "transparent";
            infoElement.style.boxShadow = "none";
            infoElement.style.borderRadius = "12px";
            infoElement.style.overflow = "visible";
            infoElement.style.padding = "0";
            infoElement.style.maxWidth = `${previewWidth}px`;
            infoElement.style.pointerEvents = "none";
            let chromeParent = infoElement.parentElement;
            for (let level = 0; chromeParent && level < 3; level += 1) {
              chromeParent.style.pointerEvents = "none";
              chromeParent = chromeParent.parentElement;
            }

            const contentElement =
              infoElement.querySelector<HTMLElement>(".gm-style-iw-d");
            if (contentElement) {
              contentElement.style.overflow = "visible";
              contentElement.style.maxHeight = "none";
              contentElement.style.width = `${cardWidth}px`;
              contentElement.style.pointerEvents = "none";
            }

            const defaultCloseButton = infoElement.querySelector<HTMLElement>(
              ".gm-ui-hover-effect"
            );
            if (defaultCloseButton) {
              defaultCloseButton.style.display = "none";
            }
          };

          const keepPreviewInsideMap = () => {
            polishPreviewChrome();

            const mapElement = containerRef.current;
            const infoElement = mapElement?.querySelector<HTMLElement>(
              ".gm-style-iw.gm-style-iw-c"
            );
            if (!mapElement || !infoElement) return;

            const mapRect = mapElement.getBoundingClientRect();
            const infoRect = infoElement.getBoundingClientRect();
            const margin = 8;
            let nextOffsetX = offsetX;
            let nextOffsetY = offsetY;

            if (infoRect.left < mapRect.left + margin) {
              nextOffsetX += Math.round(mapRect.left + margin - infoRect.left);
            } else if (infoRect.right > mapRect.right - margin) {
              nextOffsetX -= Math.round(
                infoRect.right - (mapRect.right - margin)
              );
            }

            if (infoRect.top < mapRect.top + margin) {
              nextOffsetY += Math.round(mapRect.top + margin - infoRect.top);
            } else if (infoRect.bottom > mapRect.bottom - margin) {
              nextOffsetY -= Math.round(
                infoRect.bottom - (mapRect.bottom - margin)
              );
            }

            if (nextOffsetX !== offsetX || nextOffsetY !== offsetY) {
              offsetX = nextOffsetX;
              offsetY = nextOffsetY;
              hoverInfo.setOptions({
                disableAutoPan: true,
                maxWidth: previewWidth,
                pixelOffset: new maps.Size(offsetX, offsetY),
              });
              window.requestAnimationFrame(polishPreviewChrome);
            }
          };

          window.requestAnimationFrame(() => {
            keepPreviewInsideMap();
            window.requestAnimationFrame(keepPreviewInsideMap);
          });

          const cardElement = containerRef.current?.querySelector<HTMLElement>(
            '[data-viza-trip-hover-card="true"]'
          );
          cardElement?.addEventListener("mouseenter", clearPreviewCloseTimer);
          cardElement?.addEventListener("mouseleave", () => {
            if (!previewPinned) schedulePreviewClose(80);
          });

          const openDetail = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            setDetailPointId(point.id);
            hoverInfo.close();
          };
          let imageIndex = 0;
          const updatePreviewImage = () => {
            const imageElement = document.getElementById(
              imageElementId
            ) as HTMLImageElement | null;
            if (imageElement) {
              imageElement.src =
                galleryImages[imageIndex] ?? galleryImages[0] ?? "";
            }
            galleryImages.forEach((_, index) => {
              const dotElement = document.getElementById(
                `${dotIdPrefix}-${index}`
              );
              if (dotElement) {
                dotElement.style.background = `rgba(255,255,255,${
                  index === imageIndex ? ".96" : ".62"
                })`;
              }
            });
          };
          document
            .getElementById(previousPhotoButtonId)
            ?.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              const imageCount = Math.max(galleryImages.length, 1);
              imageIndex = (imageIndex - 1 + imageCount) % imageCount;
              updatePreviewImage();
            });
          document
            .getElementById(photoButtonId)
            ?.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              imageIndex = (imageIndex + 1) % Math.max(galleryImages.length, 1);
              updatePreviewImage();
            });
          document
            .getElementById(summaryButtonId)
            ?.addEventListener("click", openDetail, { once: true });

          const addDestination = onAddDestinationRef.current;
          if (addDestination) {
            const button = document.getElementById(buttonId);
            if (!button) return;
            button.addEventListener(
              "click",
              (event) => {
                event.preventDefault();
                event.stopPropagation();
                addDestination(point);
                hoverInfo.close();
              },
              { once: true }
            );
          }
        });
      };
      const openPinnedPreview = () => {
        if (reopenPreviewTimer !== null) {
          window.clearTimeout(reopenPreviewTimer);
        }

        openPreview(true);
        reopenPreviewTimer = window.setTimeout(() => {
          reopenPreviewTimer = null;
          openPreview(true);
        }, 380);
      };

      const listeners = [
        marker.addListener("mousedown", () => {
          onPointSelectRef.current?.(point.id);
          openPinnedPreview();
        }),
        marker.addListener("click", () => {
          onPointSelectRef.current?.(point.id);
          openPinnedPreview();
        }),
        marker.addListener("mouseover", () => openPreview(false)),
        marker.addListener("mouseout", () => {
          if (!previewPinned) schedulePreviewClose(220);
        }),
      ];

      markersRef.current.push({ marker, listeners, id: point.id, point });
    });

    refreshMarkerVisualsRef.current();

    const clearRouteLines = () => {
      if (routeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(routeAnimationFrameRef.current);
        routeAnimationFrameRef.current = null;
      }
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
      animatedRouteLineRef.current?.setMap(null);
      animatedRouteLineRef.current = null;
    };

    clearRouteLines();
    const routePath = routeCoordinates.map(([lat, lng]) => ({ lat, lng }));
    if (routePath.length >= 2) {
      const routeLineOptions = {
        path: routePath,
        map,
        geodesic: true,
        strokeColor: "#2d1635",
        strokeOpacity: animateRoute ? 0.32 : 0.78,
        strokeWeight: animateRoute ? 4 : 5,
        zIndex: 1,
      };
      routeLineRef.current = new maps.Polyline(
        animateRoute
          ? {
              ...routeLineOptions,
              icons: [
                {
                  icon: {
                    path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 3,
                    strokeColor: "#2d1635",
                    strokeWeight: 2,
                  },
                  offset: "100%",
                  repeat: "130px",
                },
              ],
            }
          : routeLineOptions
      );

      if (animateRoute) {
        const animatedRouteLine = new maps.Polyline({
          path: [routePath[0]!],
          map,
          geodesic: true,
          strokeColor: "#8d5df7",
          strokeOpacity: 0.95,
          strokeWeight: 7,
          zIndex: 2,
        });
        animatedRouteLineRef.current = animatedRouteLine;

        const animationDuration = 4200;
        const startTime = performance.now();
        const tick = (timestamp: number) => {
          const progress =
            ((timestamp - startTime) % animationDuration) / animationDuration;
          animatedRouteLine.setPath(interpolateRoutePath(routePath, progress));
          routeAnimationFrameRef.current = window.requestAnimationFrame(tick);
        };
        routeAnimationFrameRef.current = window.requestAnimationFrame(tick);
      }
    }

    const bounds = new maps.LatLngBounds();
    let coordinateCount = 0;
    const fitCoordinates: GoogleLatLngLiteral[] = [];

    routePath.forEach((point) => {
      bounds.extend(point);
      fitCoordinates.push(point);
      coordinateCount += 1;
    });
    const hasTripSpecificPoint = points.some(
      (point) => !point.id.startsWith("city-suggestion-")
    );
    const fitPoints = hasTripSpecificPoint
      ? points.filter((point) => !point.id.startsWith("city-suggestion-"))
      : points;

    fitPoints.forEach((point) => {
      const coordinate = { lat: point.lat, lng: point.lng };
      bounds.extend(coordinate);
      fitCoordinates.push(coordinate);
      coordinateCount += 1;
    });

    const fitKey = `${pointKey}__${routeKey}__${mapWidth}x${mapHeight}`;
    const shouldFit = fitKey !== fitKeyRef.current;

    if (coordinateCount >= 2 && shouldFit) {
      const fallbackCenter = calculateCoordinateCenter(fitCoordinates);
      const fallbackZoom = estimateCoordinateZoom(
        fitCoordinates,
        mapWidth,
        mapHeight
      );
      const fitVisibleRoute = () => {
        if (effectDisposed) return;
        map.fitBounds(bounds, 72);
        const fallbackTimeoutId = window.setTimeout(() => {
          if (effectDisposed) return;
          map.setCenter(fallbackCenter);
          map.setZoom(fallbackZoom);
        }, 80);
        fitFallbackTimeoutIds.push(fallbackTimeoutId);
      };
      const markFitComplete = () => {
        if (effectDisposed) return;
        fittedOnceRef.current = true;
        fitKeyRef.current = fitKey;
      };
      fitVisibleRoute();
      fitRetryTimeoutId = window.setTimeout(() => {
        fitVisibleRoute();
        markFitComplete();
      }, 260);
    } else if (coordinateCount === 1 && points.length > 0 && shouldFit) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng });
      map.setZoom(points[0].kind === "hotspot" ? 13 : 6);
      fittedOnceRef.current = true;
      fitKeyRef.current = fitKey;
    } else if (!fittedOnceRef.current) {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }

    return () => {
      effectDisposed = true;
      if (fitRetryTimeoutId !== null) {
        window.clearTimeout(fitRetryTimeoutId);
      }
      fitFallbackTimeoutIds.forEach((timeoutId) =>
        window.clearTimeout(timeoutId)
      );
      clearRouteLines();
    };
  }, [
    animateRoute,
    isReady,
    isZh,
    pointKey,
    points,
    routeCoordinates,
    routeKey,
  ]);

  useEffect(() => {
    if (!isReady) return;
    refreshMarkerVisuals();
  }, [activePointId, isReady, pointKey, refreshMarkerVisuals]);

  const activeFocusKeyRef = useRef("");

  useEffect(() => {
    if (!isReady || !activeFocusKey || !activePointId) return;
    if (activeFocusKeyRef.current === activeFocusKey) return;

    const map = mapRef.current;
    if (!map) return;

    const activePoint = points.find((point) => point.id === activePointId);
    if (!activePoint) return;

    activeFocusKeyRef.current = activeFocusKey;

    let disposed = false;
    const focusZoom =
      activePoint.kind === "hotel"
        ? 13
        : activePoint.kind === "hotspot"
          ? 12
          : 10;
    const focusMap = () => {
      if (disposed) return;
      map.setCenter({ lat: activePoint.lat, lng: activePoint.lng });
      const currentZoom = map.getZoom() ?? DEFAULT_ZOOM;
      if (currentZoom < focusZoom) {
        map.setZoom(focusZoom);
      }
    };

    hoverInfoRef.current?.close();
    focusMap();
    const focusAfterFitBounds = window.setTimeout(focusMap, 340);

    return () => {
      disposed = true;
      window.clearTimeout(focusAfterFitBounds);
    };
  }, [activeFocusKey, activePointId, isReady, points]);

  const detailSections = useMemo<DetailSection[]>(() => {
    if (!detailPoint) return [];
    const city =
      getLocalNameFromValue(detailPoint.city) ??
      getPointDisplayName(detailPoint);
    const location = getPointDisplayLocation(detailPoint);

    return (["attractions", "food", "stay", "nightlife"] as const).map(
      (sectionId) => {
        const sample = buildDetailSectionSample(
          detailPoint,
          sectionId,
          city,
          location
        );
        const meta = DETAIL_SECTION_META[sectionId];
        return {
          id: sectionId,
          title: meta.title,
          icon: meta.icon,
          body: sample.items.join("、"),
          ...sample,
        };
      }
    );
  }, [detailPoint]);

  return (
    <div className={`relative ${className ?? ""}`} data-testid="trip-route-map">
      <div className="h-full w-full" ref={containerRef} />
      {detailPoint ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-30 flex w-full justify-end bg-transparent"
          data-testid="trip-map-detail-panel"
        >
          <div className="pointer-events-auto flex h-full w-1/2 max-w-[50%] flex-col border-l border-slate-200 bg-white shadow-[-20px_0_45px_rgba(15,23,42,0.12)] max-md:w-full max-md:max-w-none">
            <div className="flex items-center justify-end px-5 py-5">
              <button
                aria-label={
                  isZh ? "关闭目的地详情" : "Close destination details"
                }
                className="flex h-11 w-11 items-center justify-center rounded-full text-4xl leading-none text-slate-900 transition-all duration-200 hover:scale-105 hover:bg-slate-100"
                onClick={() => setDetailPointId(null)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-28">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-3xl font-bold text-slate-950">
                    <span>{getPointDisplayName(detailPoint)}</span>
                    <span className="text-slate-300">›</span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-rose-50 px-2 py-1 text-base font-semibold text-[#fb4d61]">
                    <span>🔥 10</span>
                    <span className="h-4 w-px bg-rose-200" />
                    <span>
                      第 1 名 · {getPointDisplayLocation(detailPoint)}
                      {detailPoint.kind === "city" ? "热门城市" : "热门景点"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xl text-slate-600">
                  <span className="text-2xl">⌖</span>
                  <span>{getPointDisplayLocation(detailPoint)}</span>
                  <span className="h-5 w-px bg-slate-300" />
                  <span>
                    {formatChineseDuration(detailPoint.recommendedDays)} 推荐
                  </span>
                </div>

                <p className="text-lg leading-relaxed text-slate-600">
                  {getPointIntro(detailPoint)}
                </p>

                <div className="flex gap-3 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {detailGalleryImages.map((imageSrc, index) => (
                    <div
                      aria-label={
                        isZh
                          ? `${getPointDisplayName(detailPoint)}照片 ${index + 1}`
                          : `${getPointDisplayName(detailPoint)} photo ${index + 1}`
                      }
                      className="h-32 min-w-[150px] flex-1 rounded-md bg-cover bg-center transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-200/60"
                      key={`${detailPoint.id}-preview-${index}`}
                      role="img"
                      style={{ backgroundImage: `url(${imageSrc})` }}
                    />
                  ))}
                  <button
                    aria-label={
                      isZh ? "下一张目的地照片" : "Next destination photo"
                    }
                    className="mr-1 flex h-14 w-14 shrink-0 self-center rounded-full bg-white text-4xl text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.16)]"
                    type="button"
                  >
                    <span className="m-auto">›</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {detailSections.map((section) => {
                    const isExpanded = expandedDetailSectionId === section.id;
                    return (
                      <div
                        className="overflow-hidden rounded-xl bg-gradient-to-r from-slate-50 to-blue-50/80 transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-50 hover:to-blue-100/70 hover:shadow-xl hover:shadow-blue-100/70"
                        key={section.id}
                      >
                        <button
                          aria-expanded={isExpanded}
                          className="group flex w-full items-center gap-4 px-4 py-4 text-left"
                          onClick={() =>
                            setExpandedDetailSectionId(
                              isExpanded ? null : section.id
                            )
                          }
                          type="button"
                        >
                          <span className="text-2xl text-slate-600">
                            {section.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-xl font-bold text-slate-950">
                              {section.title}
                              <span
                                className={`inline-block text-slate-500 transition-transform ${
                                  isExpanded
                                    ? "rotate-90"
                                    : "group-hover:translate-x-1"
                                }`}
                              >
                                ›
                              </span>
                            </span>
                            <span className="mt-3 line-clamp-2 block text-base leading-relaxed text-slate-900">
                              {section.body}
                            </span>
                          </span>
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                            {section.items.length}
                          </span>
                        </button>
                        {isExpanded ? (
                          <div className="border-t border-white/80 px-4 pb-4">
                            <div className="grid grid-cols-2 gap-3 pt-4 max-lg:grid-cols-1">
                              {section.items.map((item) => {
                                const itemMedia = getDetailItemMedia(
                                  section.id,
                                  item,
                                  getPointDisplayName(detailPoint)
                                );
                                return (
                                  <article
                                    className="group overflow-hidden rounded-xl bg-white/85 shadow-sm shadow-blue-100/60 ring-1 ring-white/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-200/60"
                                    key={`${section.id}-${item}`}
                                  >
                                    {itemMedia.imageSrc ? (
                                      <div
                                        aria-hidden="true"
                                        className="h-24 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                                        style={{
                                          backgroundImage: `url(${itemMedia.imageSrc})`,
                                        }}
                                      />
                                    ) : null}
                                    <div className="space-y-2 px-3 py-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <h4 className="line-clamp-1 text-sm font-semibold text-slate-950">
                                          {item}
                                        </h4>
                                        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                          {isZh ? "精选" : "Featured"}
                                        </span>
                                      </div>
                                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
                                        {itemMedia.description}
                                      </p>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                            <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm leading-relaxed text-slate-600">
                              {section.tip}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {section.tags.map((tag) => (
                                <span
                                  className="rounded-full bg-blue-100/80 px-2.5 py-1 text-xs font-medium text-blue-700"
                                  key={`${section.id}-${tag}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {onAddDestination ? (
              <div className="border-t border-slate-100 bg-white/95 px-8 py-6">
                <button
                  className="ml-auto block w-full max-w-xs rounded-lg bg-[#3464f4] px-6 py-4 text-xl font-medium text-white transition-colors hover:bg-[#2554e8]"
                  onClick={() => {
                    onAddDestination(detailPoint);
                    setDetailPointId(null);
                  }}
                  type="button"
                >
                  {isZh ? "加入我的计划" : "Add to my plan"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {loadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/85 p-4 text-center text-sm text-slate-700">
          {isZh ? "地图加载失败：" : "Map failed to load: "}
          {loadError}
        </div>
      ) : null}
    </div>
  );
}

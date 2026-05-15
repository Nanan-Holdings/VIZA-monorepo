"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type GoogleMapsNamespace = {
  Map: new (
    container: HTMLElement,
    options: {
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
          east: number;
          west: number;
        };
        strictBounds: boolean;
      };
    }
  ) => GoogleMapInstance;
  Marker: new (options: {
    position: GoogleLatLngLiteral;
    map?: GoogleMapInstance | null;
    title?: string;
    icon?: GoogleMapMarkerIcon;
    label?: GoogleMarkerLabel;
    optimized?: boolean;
    zIndex?: number;
  }) => GoogleMarkerInstance;
  InfoWindow: new (options?: { content?: string; disableAutoPan?: boolean }) => GoogleInfoWindowInstance;
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
  bangkok: NETWORK_CITY_IMAGES_BY_KEY.bangkok,
  seoul: NETWORK_CITY_IMAGES_BY_KEY.seoul,
  hongkong: NETWORK_CITY_IMAGES_BY_KEY.hongkong,
  marinabaysands: ["/globe/singapore.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.singapore],
  gardensbythebay: ["/globe/singapore.jpg", ...NETWORK_CITY_IMAGES_BY_KEY.singapore],
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
const LABEL_MIN_ZOOM = 3;
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

function hashLookupString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildFallbackNetworkGalleryImages(value: string | undefined): string[] {
  const city = value?.trim();
  if (!city) return [];

  const encodedCity = encodeURIComponent(city);
  const lockBase = (hashLookupString(city) % 7000) + 1000;

  return ["city", "landmark", "skyline", "travel"].map(
    (tag, index) =>
      `https://loremflickr.com/960/640/${encodedCity},${tag}?lock=${lockBase + index}`
  );
}

function getImageLookupKey(imageSrc: string | undefined): string {
  if (!imageSrc) return "";
  return normalizeLookupKey(imageSrc.split("/").pop()?.replace(/\.[^.]+$/, ""));
}

function getPointLookupKeys(point: TripMapPoint): string[] {
  return Array.from(
    new Set(
      [point.label, point.city, point.localName, point.subtitle, getImageLookupKey(point.imageSrc)]
        .map(normalizeLookupKey)
        .filter(Boolean)
    )
  );
}

function getLocalNameFromValue(value: string | undefined): string | null {
  const key = normalizeLookupKey(value);
  return key ? LOCAL_NAME_BY_KEY[key] ?? null : null;
}

function getPointDisplayName(point: TripMapPoint): string {
  const cityLocalName = getLocalNameFromValue(point.city);
  if (cityLocalName) return cityLocalName;
  if (point.city) return point.localName ?? point.city;
  const labelLocalName = getLocalNameFromValue(point.label);
  if (labelLocalName) return labelLocalName;
  if (point.kind === "city" && point.localName) return point.localName;
  if (point.kind !== "city" && point.localName && point.localName !== point.city) {
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
  getPointLookupKeys(point).forEach((key) => {
    orderedImages.push(...(GALLERY_IMAGES_BY_KEY[key] ?? []));
  });

  const uniqueImages = Array.from(new Set(orderedImages.filter(Boolean)));
  if (uniqueImages.length < 4) {
    uniqueImages.push(...buildFallbackNetworkGalleryImages(point.city ?? point.label));
  }

  return Array.from(new Set(uniqueImages)).slice(0, GALLERY_MAX_IMAGES);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
  const visiblePath = routePath.slice(0, Math.min(completedSegments + 1, routePath.length));

  if (completedSegments < routePath.length - 1) {
    const start = routePath[completedSegments]!;
    const end = routePath[completedSegments + 1]!;
    visiblePath.push({
      lat: start.lat + (end.lat - start.lat) * partialProgress,
      lng: start.lng + (end.lng - start.lng) * partialProgress,
    });
  }

  return visiblePath;
}

function toWorldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const safeLat = clamp(lat, -85, 85);
  const sinLat = Math.sin((safeLat * Math.PI) / 180);
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
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
  const world = toWorldPixel(lat, lng, zoom);
  return {
    x: mapWidth / 2 + (world.x - centerWorld.x),
    y: mapHeight / 2 + (world.y - centerWorld.y),
  };
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
  drawRoundedRectPath(ctx, 3, 3, dims.bodySize + 4, dims.bodySize + 4, dims.borderRadius + 3);
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
  const fallbackText = (point.localName ?? point.label ?? "?").trim().slice(0, 1) || "?";
  ctx.fillText(fallbackText, Math.round(dims.width / 2), Math.round((dims.bodySize + 8) / 2));

  return canvas.toDataURL("image/png");
}

function loadImageForCanvas(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`marker image load failed: ${imageUrl}`));
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

    drawRoundedRectPath(ctx, 3, 3, dims.bodySize + 4, dims.bodySize + 4, dims.borderRadius + 3);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = dims.strokeWidth;
    ctx.strokeStyle = dims.strokeColor;
    ctx.stroke();

    const imageInset = 5;
    const imageSize = dims.bodySize;
    ctx.save();
    drawRoundedRectPath(ctx, imageInset, imageInset, imageSize, imageSize, dims.borderRadius);
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

function buildMarkerLabel(point: TripMapPoint, iconSize: number): GoogleMarkerLabel {
  return {
    text: point.localName ?? point.label,
    color: "#0f2a56",
    fontSize: `${clamp(Math.round(iconSize * 0.22), 10, 14)}px`,
    fontWeight: "700",
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
  if (point.countryLabel) return point.countryLabel.replace(/\s*\([^)]*\)/g, "").trim();
  if (point.subtitle.includes(" in ")) {
    const subtitleLocation = point.subtitle.split(" in ").at(-1)?.trim() || point.subtitle;
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
  const city = getPointDisplayName(point);
  const attractionName = getLocalNameFromValue(point.label) ?? point.label;
  const base =
    point.kind === "city"
      ? [`${city}经典地标`, `${city}热门街区`, "观景点", "夜市"]
      : [attractionName, `${city}步行路线`, "当地美食", "观景点", "夜景"];
  return Array.from(new Set(base)).join("、");
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
  const duration = formatChineseDuration(point.recommendedDays);
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
          ? `<button id="${previousPhotoButtonId}" type="button" aria-label="上一张照片" style="${galleryButtonStyle}left:12px;"><span style="display:block;line-height:1;transform:translateY(-1px);">‹</span></button>`
          : ""
      }
      ${
        photoButtonId
          ? `<button id="${photoButtonId}" type="button" aria-label="下一张照片" style="${galleryButtonStyle}right:12px;"><span style="display:block;line-height:1;transform:translateY(-1px);">›</span></button>`
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
        <span style="color:#0f3bae;">热门景点：</span> <span style="color:#020617;">${escapeHtml(attractions)}</span>
      </button>
      <div style="margin-top:10px;display:flex;align-items:center;gap:7px;font-size:${bodySize}px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        <span style="font-size:${compact ? 14 : 16}px;color:#475569;">⌖</span>
        <span>${escapeHtml(cityOrCountry)}</span>
        <span style="height:13px;width:1px;background:#cbd5e1;"></span>
        <span>${escapeHtml(duration)} 推荐</span>
      </div>
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
      reject(new Error("Google Maps API loaded, but window.google.maps is unavailable"));
    };

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
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
  })
    .catch((error) => {
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

  const pointKey = useMemo(
    () => points.map((point) => `${point.id}:${point.lat}:${point.lng}`).join("|"),
    [points]
  );

  const routeKey = useMemo(
    () => routeCoordinates.map(([lat, lng]) => `${lat},${lng}`).join("|"),
    [routeCoordinates]
  );

  const activeFocusKey = useMemo(() => {
    if (!activePointId) return "";
    if (routeCoordinates.length >= 2) return "";

    const hasSelectedDestination = points.some(
      (point) => point.kind === "city" || point.kind === "hotel"
    );
    if (!hasSelectedDestination) return "";

    const activePoint = points.find((point) => point.id === activePointId);
    if (!activePoint) return "";

    return `${activePoint.id}:${activePoint.lat}:${activePoint.lng}:${activePoint.kind}`;
  }, [activePointId, points, routeCoordinates.length]);

  const detailPoint = useMemo(
    () => points.find((point) => point.id === detailPointId) ?? null,
    [detailPointId, points]
  );
  const detailGalleryImages = useMemo(
    () => (detailPoint ? getPointGalleryImages(detailPoint) : []),
    [detailPoint]
  );

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
    const zoom = map.getZoom() ?? DEFAULT_ZOOM;
    const mapWidth = containerRef.current?.clientWidth ?? 1200;
    const mapHeight = containerRef.current?.clientHeight ?? 800;
    const iconSize = getAdaptiveIconSize(markersRef.current.length, mapWidth, mapHeight);
    const showLabel = zoom >= LABEL_MIN_ZOOM;

    markersRef.current.forEach(({ marker, point }) => {
      const isActive = point.id === activePointIdRef.current;
      const fallbackMarkerUrl = createSolidBubbleMarkerDataUrl(
        point,
        iconSize,
        isActive
      );
      marker.setIcon(buildMarkerIcon(maps, point, isActive, iconSize, fallbackMarkerUrl));
      marker.setLabel(showLabel ? buildMarkerLabel(point, iconSize) : undefined);
      marker.setZIndex(isActive ? 1000 : 100);

      void getBubbleMarkerDataUrl(point, iconSize, isActive).then((markerDataUrl) => {
        const markerStillMounted = markersRef.current.some(
          (entry) => entry.marker === marker && entry.id === point.id
        );
        if (!markerStillMounted || markerVisualVersionRef.current !== visualVersion) {
          return;
        }

        marker.setIcon(buildMarkerIcon(maps, point, isActive, iconSize, markerDataUrl));
      });
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
    let disposed = false;
    let markerRefreshFrameId: number | null = null;

    void (async () => {
      if (!containerRef.current || mapRef.current) return;
      try {
        const maps = await loadGoogleMaps(GOOGLE_MAPS_API_KEY);
        if (disposed || !containerRef.current) return;

        mapsRef.current = maps;
        const map = new maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: 17,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          gestureHandling: "greedy",
          restriction: {
            latLngBounds: {
              north: 85,
              south: -85,
              west: -179.9,
              east: 179.9,
            },
            strictBounds: true,
          },
        });

        hoverInfoRef.current = new maps.InfoWindow({
          disableAutoPan: true,
        });

        mapRef.current = map;
        map.addListener("click", () => {
          hoverInfoRef.current?.close();
        });

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
            refreshMarkerVisualsRef.current();
          });
        };

        layoutRerenderListenersRef.current = [
          map.addListener("zoom_changed", scheduleMarkerVisualRefresh),
          map.addListener("dragstart", () => {
            hoverInfoRef.current?.close();
          }),
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
            refreshMarkerVisualsRef.current();
          }, delay);
        });
        setLoadError(null);
        setIsReady(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to initialize Google Maps";
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
      layoutRerenderListenersRef.current.forEach((listener) => listener.remove());
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
    const showLabel = zoom >= LABEL_MIN_ZOOM;
    let effectDisposed = false;
    let fitRetryTimeoutId: number | null = null;
    const fitFallbackTimeoutIds: number[] = [];

    const currentActivePointId = activePointIdRef.current;

    points.forEach((point) => {
      const isActive = point.id === currentActivePointId;
      const fallbackMarkerUrl = createSolidBubbleMarkerDataUrl(point, iconSize, isActive);
      const marker = new maps.Marker({
        map,
        position: { lat: point.lat, lng: point.lng },
        title: `${point.label} · ${point.subtitle}`,
        icon: buildMarkerIcon(maps, point, isActive, iconSize, fallbackMarkerUrl),
        label: showLabel ? buildMarkerLabel(point, iconSize) : undefined,
        optimized: false,
        zIndex: isActive ? 1000 : 100,
      });

      let closePreviewTimer: number | null = null;
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

      const openPreview = () => {
        clearPreviewCloseTimer();
        const safePointId = sanitizeDomId(point.id);
        const buttonId = `trip-map-add-${safePointId}`;
        const previousPhotoButtonId = `trip-map-photo-prev-${safePointId}`;
        const photoButtonId = `trip-map-photo-${safePointId}`;
        const summaryButtonId = `trip-map-summary-${safePointId}`;
        const imageElementId = `trip-map-image-${safePointId}`;
        const dotIdPrefix = `trip-map-dot-${safePointId}`;
        const galleryImages = getPointGalleryImages(point).map(resolveMarkerImageUrl);
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
            `加入我的计划：${cityForPlan}`,
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

            const defaultCloseButton =
              infoElement.querySelector<HTMLElement>(".gm-ui-hover-effect");
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
              nextOffsetX -= Math.round(infoRect.right - (mapRect.right - margin));
            }

            if (infoRect.top < mapRect.top + margin) {
              nextOffsetY += Math.round(mapRect.top + margin - infoRect.top);
            } else if (infoRect.bottom > mapRect.bottom - margin) {
              nextOffsetY -= Math.round(infoRect.bottom - (mapRect.bottom - margin));
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
          cardElement?.addEventListener("mouseleave", () => schedulePreviewClose(80));

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
              imageElement.src = galleryImages[imageIndex] ?? galleryImages[0] ?? "";
            }
            galleryImages.forEach((_, index) => {
              const dotElement = document.getElementById(`${dotIdPrefix}-${index}`);
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

      const listeners = [
        marker.addListener("click", () => {
          onPointSelectRef.current?.(point.id);
          openPreview();
        }),
        marker.addListener("mouseover", openPreview),
        marker.addListener("mouseout", () => schedulePreviewClose(220)),
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
          const progress = ((timestamp - startTime) % animationDuration) / animationDuration;
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
    points.forEach((point) => {
      const coordinate = { lat: point.lat, lng: point.lng };
      bounds.extend(coordinate);
      fitCoordinates.push(coordinate);
      coordinateCount += 1;
    });

    const fitKey = `${pointKey}__${routeKey}__${mapWidth}x${mapHeight}`;
    const shouldFit = fitKey !== fitKeyRef.current;

    if (coordinateCount >= 2 && shouldFit) {
      const fallbackCenter = calculateCoordinateCenter(fitCoordinates);
      const fallbackZoom = estimateCoordinateZoom(fitCoordinates, mapWidth, mapHeight);
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
      map.setZoom(6);
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
      fitFallbackTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      clearRouteLines();
    };
  }, [
    animateRoute,
    isReady,
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
      activePoint.kind === "hotel" ? 13 : activePoint.kind === "hotspot" ? 12 : 10;
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

  const detailSections = useMemo(() => {
    if (!detailPoint) return [];
    const city = getLocalNameFromValue(detailPoint.city) ?? getPointDisplayName(detailPoint);
    const location = getPointDisplayLocation(detailPoint);

    return [
      {
        id: "attractions",
        title: "热门景点",
        icon: "⌁",
        body: getPointAttractions(detailPoint),
      },
      {
        id: "food",
        title: "必吃美食",
        icon: "♨",
        body: `${city}当地小吃、招牌餐厅、咖啡甜品、夜市`,
      },
      {
        id: "stay",
        title: "热门住宿区域",
        icon: "▥",
        body: `靠近${location}核心区、地标街区、交通便利区域`,
      },
      {
        id: "nightlife",
        title: "夜生活",
        icon: "⌁",
        body: `${city}夜景、河岸散步、屋顶酒吧、夜市`,
      },
    ];
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
                aria-label="关闭目的地详情"
                className="flex h-11 w-11 items-center justify-center rounded-full text-4xl leading-none text-slate-900 transition-colors hover:bg-slate-100"
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
                    <span>第 1 名 · {getPointDisplayLocation(detailPoint)}热门城市</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xl text-slate-600">
                  <span className="text-2xl">⌖</span>
                  <span>{getPointDisplayLocation(detailPoint)}</span>
                  <span className="h-5 w-px bg-slate-300" />
                  <span>{formatChineseDuration(detailPoint.recommendedDays)} 推荐</span>
                </div>

                <p className="text-lg leading-relaxed text-slate-600">
                  {getPointIntro(detailPoint)}
                </p>

                <div className="flex gap-3 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {detailGalleryImages.map((imageSrc, index) => (
                    <div
                      aria-label={`${getPointDisplayName(detailPoint)}照片 ${index + 1}`}
                      className="h-32 min-w-[150px] flex-1 rounded-md bg-cover bg-center"
                      key={`${detailPoint.id}-preview-${index}`}
                      role="img"
                      style={{ backgroundImage: `url(${imageSrc})` }}
                    />
                  ))}
                  <button
                    aria-label="下一张目的地照片"
                    className="mr-1 flex h-14 w-14 shrink-0 self-center rounded-full bg-white text-4xl text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.16)]"
                    type="button"
                  >
                    <span className="m-auto">›</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {detailSections.map((section) => (
                    <button
                      className="flex w-full items-center gap-4 rounded-xl bg-gradient-to-r from-slate-50 to-blue-50/80 px-4 py-4 text-left transition-colors hover:from-blue-50 hover:to-blue-100/70"
                      key={section.id}
                      type="button"
                    >
                      <span className="text-2xl text-slate-600">{section.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xl font-bold text-slate-950">
                          {section.title} ›
                        </span>
                        <span className="mt-3 line-clamp-2 block text-base leading-relaxed text-slate-900">
                          {section.body}
                        </span>
                      </span>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xl text-blue-600">
                        ●
                      </span>
                    </button>
                  ))}
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
                  加入我的计划
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {loadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/85 p-4 text-center text-sm text-slate-700">
          地图加载失败：{loadError}
        </div>
      ) : null}
    </div>
  );
}

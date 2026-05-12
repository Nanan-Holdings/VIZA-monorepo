"use client";

import {
  GoogleMap,
  Marker,
  InfoWindow,
  DirectionsRenderer,
  useLoadScript,
} from "@react-google-maps/api";

import { useState, useEffect, useRef } from "react";

type MapProps = {
  cities: string[];
  activeCity: string | null;
  onCitySelect?: (city: string) => void;
};

type CityCoord = {
  lat: number;
  lng: number;
};

const containerStyle = {
  width: "100%",
  height: "400px",
};

const cityCoords: Record<string, CityCoord> = {
  Tokyo: { lat: 35.6762, lng: 139.6503 },
  东京: { lat: 35.6762, lng: 139.6503 },
  Osaka: { lat: 34.6937, lng: 135.5023 },
  大阪: { lat: 34.6937, lng: 135.5023 },
  Kyoto: { lat: 35.0116, lng: 135.7681 },
  京都: { lat: 35.0116, lng: 135.7681 },
  Paris: { lat: 48.8566, lng: 2.3522 },
  巴黎: { lat: 48.8566, lng: 2.3522 },
  Lyon: { lat: 45.764, lng: 4.8357 },
  里昂: { lat: 45.764, lng: 4.8357 },
};

export default function Map({ cities, activeCity, onCitySelect }: MapProps) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const path = cities.map((city) => cityCoords[city]).filter(Boolean);

  // Timeline → Map
  useEffect(() => {
    if (!activeCity || !mapRef.current) return;

    const coord = cityCoords[activeCity];
    if (!coord) return;

    mapRef.current.panTo(coord);
    mapRef.current.setZoom(8);
  }, [activeCity]);

  // 路线
  useEffect(() => {
    if (!window.google || cities.length < 2) return;

    const directionsService = new window.google.maps.DirectionsService();

    const origin = cityCoords[cities[0]];
    const destination = cityCoords[cities[cities.length - 1]];
    if (!origin || !destination) return;

    directionsService.route(
      {
        origin,
        destination,
        waypoints: cities
          .slice(1, -1)
          .map((city) => cityCoords[city])
          .filter(Boolean)
          .map((location) => ({ location })),
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        }
      }
    );
  }, [cities]);

  if (!isLoaded) return <p>加载地图中...</p>;
  if (!cities || cities.length === 0) return null;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={path[0]}
      zoom={5}
      onLoad={(map) => {
        mapRef.current = map;
      }}
    >
      {cities.map((city: string) => {
        const coord = cityCoords[city];
        if (!coord) return null;

        return (
          <Marker
            key={city}
            position={coord}
            onClick={() => {
              setSelectedCity(city);
              onCitySelect?.(city);
            }}
          />
        );
      })}

      {selectedCity && (
        <InfoWindow
          position={cityCoords[selectedCity]}
          onCloseClick={() => setSelectedCity(null)}
        >
          <div>{selectedCity}</div>
        </InfoWindow>
      )}

      {directions && path.length >= 2 && <DirectionsRenderer directions={directions} />}
    </GoogleMap>
  );
}

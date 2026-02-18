import { APIProvider, InfoWindow, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Place, TravelPlan } from "../../types/plan";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const THEME = {
  gradientStart: "#6366f1",
  gradientEnd: "#8b5cf6",
  stroke: "#ffffff",
};

interface MapContainerProps {
  plan: TravelPlan | null;
  activeDayNumber: number;
  selectedPlaceName?: string | null;
  emptyKeyMessage: string;
}

interface MapsApi {
  Polyline: new (options: {
    path: { lat: number; lng: number }[];
    geodesic: boolean;
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
    clickable: boolean;
    map: object;
  }) => { setMap: (map: object | null) => void };
  LatLngBounds: new () => { extend: (point: { lat: number; lng: number }) => void };
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
}

interface GoogleApi {
  maps: MapsApi;
}

const getMapsApi = (): MapsApi | null => {
  if (typeof window === "undefined") return null;
  const api = (window as Window & { google?: GoogleApi }).google;
  return api?.maps ?? null;
};

const createMinimalPin = (index: number, isSelected: boolean) => {
  const scale = isSelected ? 1.35 : 1.0;
  const opacity = isSelected ? 1.0 : 0.95;
  const strokeWidth = isSelected ? 2.5 : 1.5;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" style="transform: scale(${scale}); transform-origin: bottom center; opacity: ${opacity}; overflow: visible;">
      <defs>
        <linearGradient id="grad-unified" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${THEME.gradientStart};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${THEME.gradientEnd};stop-opacity:1" />
        </linearGradient>
        <filter id="soft-shadow" x="-50%" y="-20%" width="200%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.2)"/>
        </filter>
      </defs>
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24c0-8.837-7.163-16-16-16z"
            fill="url(#grad-unified)"
            filter="url(#soft-shadow)"
            stroke="${THEME.stroke}"
            stroke-width="${strokeWidth}" />
      <circle cx="16" cy="16" r="6" fill="white"/>
      <text x="16" y="20" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="11" font-weight="800" fill="${THEME.gradientStart}">${index + 1}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const RoutePolyline = ({ path }: { path: { lat: number; lng: number }[] }) => {
  const map = useMap();
  const polylineRef = useRef<{ setMap: (map: object | null) => void } | null>(null);

  useEffect(() => {
    const mapsApi = getMapsApi();
    if (!map || !mapsApi) return;

    polylineRef.current?.setMap(null);
    polylineRef.current = new mapsApi.Polyline({
      path,
      geodesic: true,
      strokeColor: THEME.gradientStart,
      strokeOpacity: 0.6,
      strokeWeight: 5,
      clickable: false,
      map: map as unknown as object,
    });

    return () => polylineRef.current?.setMap(null);
  }, [map, path]);

  return null;
};

const MapViewport = ({
  places,
  selectedPlaceName,
}: {
  places: Place[];
  selectedPlaceName?: string | null;
}) => {
  const map = useMap();

  useEffect(() => {
    const mapsApi = getMapsApi();
    if (!map || !mapsApi || places.length === 0) return;

    if (selectedPlaceName) {
      const target = places.find((p) => p.placeName === selectedPlaceName);
      if (target?.location) {
        map.panTo(target.location);
        map.setZoom(15);
        return;
      }
    }

    const bounds = new mapsApi.LatLngBounds();
    let hasValid = false;

    places.forEach((p) => {
      if (!p.location) return;
      bounds.extend(p.location);
      hasValid = true;
    });

    if (hasValid) {
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
  }, [map, places, selectedPlaceName]);

  return null;
};

export const MapContainer = ({
  plan,
  activeDayNumber,
  selectedPlaceName,
  emptyKeyMessage,
}: MapContainerProps) => {
  const defaultCenter = { lat: 37.5665, lng: 126.978 };
  const mapsApi = getMapsApi();
  const [clickedPlaceName, setClickedPlaceName] = useState<string | null>(null);

  const activeDay = useMemo(() => {
    if (!plan) return null;
    return plan.days.find((day) => day.dayNumber === activeDayNumber) ?? plan.days[0] ?? null;
  }, [plan, activeDayNumber]);

  const validClickedPlaceName =
    clickedPlaceName && activeDay?.places.some((p) => p.placeName === clickedPlaceName)
      ? clickedPlaceName
      : null;

  const activePlaceName = selectedPlaceName ?? validClickedPlaceName;

  const activePlace = useMemo(() => {
    if (!activeDay || !activePlaceName) return null;
    return activeDay.places.find((p) => p.placeName === activePlaceName && p.location) ?? null;
  }, [activeDay, activePlaceName]);

  if (!API_KEY) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 px-6 text-center text-sm text-slate-400">
        {emptyKeyMessage}
      </div>
    );
  }

  const path = activeDay?.places.filter((p) => p.location).map((p) => p.location!) ?? [];

  return (
    <div className="h-full w-full outline-none">
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={12}
          disableDefaultUI={false}
          gestureHandling="greedy"
          className="h-full w-full"
          mapId="TRIPFLOW_MAP_V3"
          options={{
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
            minZoom: 3,
          }}
        >
          {plan && activeDay && (
            <>
              <MapViewport places={activeDay.places} selectedPlaceName={activePlaceName} />

              {path.length > 1 && <RoutePolyline path={path} />}

              {activeDay.places.map((place, idx) => {
                if (!place.location) return null;
                const isSelected = activePlaceName === place.placeName;

                return (
                  <Marker
                    key={`${activeDay.dayNumber}-${idx}`}
                    position={place.location}
                    title={place.placeName}
                    onClick={() => setClickedPlaceName(place.placeName)}
                    zIndex={isSelected ? 100 : 1}
                    icon={
                      mapsApi
                        ? {
                            url: createMinimalPin(idx, isSelected),
                            scaledSize: new mapsApi.Size(32, 40),
                            anchor: new mapsApi.Point(16, 40),
                          }
                        : {
                            url: createMinimalPin(idx, isSelected),
                          }
                    }
                  />
                );
              })}

              {activePlace?.location && (
                <InfoWindow
                  position={activePlace.location}
                  pixelOffset={[0, -44]}
                  onCloseClick={() => setClickedPlaceName(null)}
                  headerDisabled
                >
                  <div className="w-[220px] overflow-hidden rounded-lg bg-white font-sans">
                    {activePlace.photoUrl && (
                      <div className="relative h-28 w-full bg-slate-100">
                        <img
                          src={activePlace.photoUrl}
                          alt={activePlace.placeName}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <span className="absolute bottom-2 left-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white backdrop-blur-sm">
                          {activePlace.activityType}
                        </span>
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold leading-snug text-slate-900">
                          {activePlace.placeName}
                        </h3>
                        {activePlace.rating && (
                          <div className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-amber-500">
                            <span>★</span>
                            <span>{activePlace.rating}</span>
                          </div>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{activePlace.description}</p>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </>
          )}
        </Map>
      </APIProvider>
    </div>
  );
};

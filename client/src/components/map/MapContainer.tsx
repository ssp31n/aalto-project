import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef } from "react";
import type { TravelPlan } from "../../types/plan";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const DAY_COLOR = "#0ea5e9";

interface MapContainerProps {
  plan: TravelPlan | null;
  activeDayNumber: number;
  selectedPlaceName?: string | null;
  emptyKeyMessage: string;
}

const createPinDataUri = (index: number, color: string) => {
  const label = index + 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42"><path d="M17 1.5C9 1.5 2.5 8 2.5 16c0 11 14.5 23.5 14.5 23.5S31.5 27 31.5 16C31.5 8 25 1.5 17 1.5z" fill="${color}"/><circle cx="17" cy="16" r="7.7" fill="white"/><text x="17" y="19.4" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="${color}">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const RoutePolyline = ({ path }: { path: { lat: number; lng: number }[] }) => {
  const map = useMap();
  const polylineRef = useRef<{ setMap: (map: object | null) => void } | null>(null);

  useEffect(() => {
    if (!map || !window.google) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    const lineSymbol = {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillOpacity: 1,
      fillColor: DAY_COLOR,
      strokeOpacity: 0,
      scale: 2.6,
    };

    polylineRef.current = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: DAY_COLOR,
      strokeOpacity: 0.78,
      strokeWeight: 5,
      icons: [{ icon: lineSymbol, offset: "0", repeat: "18px" }],
      map,
    });

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [map, path]);

  return null;
};

const MapViewport = ({
  plan,
  activeDayNumber,
  selectedPlaceName,
}: {
  plan: TravelPlan;
  activeDayNumber: number;
  selectedPlaceName?: string | null;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google) return;

    const day = plan.days.find((item) => item.dayNumber === activeDayNumber) ?? plan.days[0];
    if (!day) return;

    const dayPoints = day.places.filter((p) => p.location);
    if (!dayPoints.length) return;

    if (selectedPlaceName) {
      const target = dayPoints.find((p) => p.placeName === selectedPlaceName);
      if (target?.location) {
        map.panTo(target.location);
        map.setZoom(14);
        return;
      }
    }

    const bounds = new window.google.maps.LatLngBounds();
    dayPoints.forEach((p) => bounds.extend(p.location!));
    map.fitBounds(bounds, 64);
  }, [map, plan, activeDayNumber, selectedPlaceName]);

  return null;
};

export const MapContainer = ({
  plan,
  activeDayNumber,
  selectedPlaceName,
  emptyKeyMessage,
}: MapContainerProps) => {
  const defaultCenter = { lat: 60.1699, lng: 24.9384 };
  const canUseGoogleSize =
    typeof window !== "undefined" &&
    Boolean((window as Window & { google?: { maps?: unknown } }).google?.maps);

  const activeDay = useMemo(() => {
    if (!plan) return null;
    return plan.days.find((day) => day.dayNumber === activeDayNumber) ?? plan.days[0] ?? null;
  }, [plan, activeDayNumber]);

  if (!API_KEY) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 px-6 text-center text-sm text-slate-600">
        {emptyKeyMessage}
      </div>
    );
  }

  const path = activeDay?.places.filter((p) => p.location).map((p) => p.location!) ?? [];

  return (
    <div className="h-full w-full">
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={12}
          disableDefaultUI={false}
          gestureHandling="greedy"
          className="h-full w-full"
          mapId="DEMO_MAP_ID"
        >
          {plan && activeDay && (
            <>
              <MapViewport
                plan={plan}
                activeDayNumber={activeDay.dayNumber}
                selectedPlaceName={selectedPlaceName}
              />

              {path.length > 1 && <RoutePolyline path={path} />}

              {activeDay.places.map((place, idx) =>
                place.location ? (
                  <Marker
                    key={`${activeDay.dayNumber}-${idx}`}
                    position={place.location}
                    title={place.placeName}
                    icon={
                      canUseGoogleSize
                        ? {
                            url: createPinDataUri(idx, DAY_COLOR),
                            scaledSize: new window.google.maps.Size(34, 42),
                          }
                        : {
                            url: createPinDataUri(idx, DAY_COLOR),
                          }
                    }
                    zIndex={selectedPlaceName === place.placeName ? 999 : 1}
                  />
                ) : null,
              )}
            </>
          )}
        </Map>
      </APIProvider>
    </div>
  );
};

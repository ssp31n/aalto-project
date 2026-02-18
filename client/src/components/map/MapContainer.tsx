// client/src/components/map/MapContainer.tsx
import { useEffect, useRef } from "react";
import { Map, Marker, useMap, APIProvider } from "@vis.gl/react-google-maps";
import type { TravelPlan } from "../../types/plan";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const PATH_COLORS = ["#2563EB", "#16A34A", "#DC2626", "#D97706", "#9333EA"];

interface MapContainerProps {
  plan: TravelPlan | null;
  selectedPlaceName?: string | null;
}

const Polyline = ({
  path,
  color,
}: {
  path: { lat: number; lng: number }[];
  color: string;
}) => {
  const map = useMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !window.google) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    polylineRef.current = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 1.0,
      strokeWeight: 4,
      map,
    });

    return () => {
      if (polylineRef.current) polylineRef.current.setMap(null);
    };
  }, [map, path, color]);

  return null;
};

const MapEffect = ({
  plan,
  selectedPlaceName,
}: {
  plan: TravelPlan;
  selectedPlaceName?: string | null;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !plan || !window.google) return;

    if (selectedPlaceName) {
      for (const day of plan.days) {
        const target = day.places.find(
          (p) => p.placeName === selectedPlaceName,
        );
        if (target?.location) {
          map.panTo(target.location);
          map.setZoom(15);
          return;
        }
      }
    }

    const bounds = new window.google.maps.LatLngBounds();
    let hasPoint = false;

    plan.days.forEach((day) => {
      day.places.forEach((place) => {
        if (place.location) {
          bounds.extend(place.location);
          hasPoint = true;
        }
      });
    });

    if (hasPoint) {
      map.fitBounds(bounds);
    }
  }, [map, plan, selectedPlaceName]);

  return null;
};

export const MapContainer = ({
  plan,
  selectedPlaceName,
}: MapContainerProps) => {
  const defaultCenter = { lat: 35.6895, lng: 139.6917 };

  // API 키가 없으면 에러 메시지를 띄우기 위함 (개발 편의성)
  if (!API_KEY) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-100 text-red-500 p-4 text-center">
        VITE_GOOGLE_MAPS_API_KEY 환경 변수가 설정되지 않았습니다. <br />
        .env 파일을 확인해주세요.
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {/* 중요: APIProvider가 Map을 감싸야 합니다. 
         onLoad는 스크립트 로드 완료 시 호출됩니다.
      */}
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={12}
          disableDefaultUI={false}
          mapId="DEMO_MAP_ID"
          className="w-full h-full"
        >
          {plan && (
            <>
              <MapEffect plan={plan} selectedPlaceName={selectedPlaceName} />

              {plan.days.map((day, dayIndex) => {
                const pathCoordinates = day.places
                  .filter((p) => p.location)
                  .map((p) => p.location!);

                return (
                  <div key={day.day}>
                    <Polyline
                      path={pathCoordinates}
                      color={PATH_COLORS[dayIndex % PATH_COLORS.length]}
                    />

                    {day.places.map(
                      (place, placeIndex) =>
                        place.location && (
                          <Marker
                            key={`${day.day}-${placeIndex}`}
                            position={place.location}
                            title={place.placeName}
                            animation={
                              selectedPlaceName === place.placeName &&
                              window.google
                                ? window.google.maps.Animation.BOUNCE
                                : undefined
                            }
                            label={{
                              text: (placeIndex + 1).toString(),
                              color: "white",
                              fontWeight: "bold",
                            }}
                            zIndex={
                              selectedPlaceName === place.placeName ? 999 : 1
                            }
                          />
                        ),
                    )}
                  </div>
                );
              })}
            </>
          )}
        </Map>
      </APIProvider>
    </div>
  );
};

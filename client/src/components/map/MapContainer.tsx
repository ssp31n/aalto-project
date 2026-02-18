import {
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Place, TravelPlan } from "../../types/plan";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// --- Color Configuration ---
const COLORS = {
  // Default State (Inactive)
  default: {
    start: "#FF9A44",
    end: "#FC6076",
  },
  // Selected State (Active)
  selected: {
    start: "#FC6076",
    end: "#FF9A44",
  },
  stroke: "#ffffff",
};

interface MapContainerProps {
  plan: TravelPlan | null;
  activeDayNumber: number;
  selectedPlaceName?: string | null;
  emptyKeyMessage: string;
  /** 지도 빈 공간 클릭 시 호출되는 콜백 (선택 해제용) */
  onMapClick?: () => void;
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
  LatLngBounds: new () => {
    extend: (point: { lat: number; lng: number }) => void;
  };
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

/**
 * Modern Pin Generator
 * - No White Circle inside
 * - White Text
 * - Changes Color on Select (No scaling)
 */
const createMinimalPin = (index: number, isSelected: boolean) => {
  // 1. Scale Logic: 확대 효과 제거 (항상 1.0)
  const scale = 1.0;
  const opacity = 1.0;
  // 선택 시 테두리를 약간 두껍게 하여 선명도 확보
  const strokeWidth = isSelected ? 2.0 : 1.2;

  // 2. Color Logic: 선택 시 붉은 계열로 변경
  const startColor = isSelected ? COLORS.selected.start : COLORS.default.start;
  const endColor = isSelected ? COLORS.selected.end : COLORS.default.end;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" style="transform: scale(${scale}); transform-origin: bottom center; opacity: ${opacity}; overflow: visible;">
      <defs>
        <linearGradient id="grad-${index}-${isSelected ? "sel" : "def"}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${startColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${endColor};stop-opacity:1" />
        </linearGradient>
        <filter id="soft-shadow" x="-50%" y="-20%" width="200%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
        </filter>
      </defs>
      
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24c0-8.837-7.163-16-16-16z"
            fill="url(#grad-${index}-${isSelected ? "sel" : "def"})"
            filter="url(#soft-shadow)"
            stroke="${COLORS.stroke}"
            stroke-width="${strokeWidth}" />
            
      <text x="16" y="21" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="13" font-weight="700" fill="white">${index + 1}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const RoutePolyline = ({ path }: { path: { lat: number; lng: number }[] }) => {
  const map = useMap();
  const polylineRef = useRef<{ setMap: (map: object | null) => void } | null>(
    null,
  );

  useEffect(() => {
    const mapsApi = getMapsApi();
    if (!map || !mapsApi) return;

    polylineRef.current?.setMap(null);
    polylineRef.current = new mapsApi.Polyline({
      path,
      geodesic: true,
      strokeColor: COLORS.default.start, // 경로 색상은 기본 색상 유지
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
  onMapClick, // [NEW] 부모로부터 전달받는 클릭 핸들러
}: MapContainerProps) => {
  const defaultCenter = { lat: 37.5665, lng: 126.978 };
  const mapsApi = getMapsApi();
  const [clickedPlaceName, setClickedPlaceName] = useState<string | null>(null);

  const activeDay = useMemo(() => {
    if (!plan) return null;
    return (
      plan.days.find((day) => day.dayNumber === activeDayNumber) ??
      plan.days[0] ??
      null
    );
  }, [plan, activeDayNumber]);

  const validClickedPlaceName =
    clickedPlaceName &&
    activeDay?.places.some((p) => p.placeName === clickedPlaceName)
      ? clickedPlaceName
      : null;

  const activePlaceName = selectedPlaceName ?? validClickedPlaceName;

  const activePlace = useMemo(() => {
    if (!activeDay || !activePlaceName) return null;
    return (
      activeDay.places.find(
        (p) => p.placeName === activePlaceName && p.location,
      ) ?? null
    );
  }, [activeDay, activePlaceName]);

  if (!API_KEY) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 px-6 text-center text-sm text-slate-400">
        {emptyKeyMessage}
      </div>
    );
  }

  const path =
    activeDay?.places.filter((p) => p.location).map((p) => p.location!) ?? [];

  return (
    <div className="h-full w-full outline-none">
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={12}
          disableDefaultUI={false}
          gestureHandling="greedy"
          className="h-full w-full"
          mapId="triplo_MAP_V3"
          options={{
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
            minZoom: 3,
          }}
          // [NEW] 지도 빈 공간 클릭 시 선택 해제 처리
          onClick={() => {
            setClickedPlaceName(null); // 내부 인포윈도우 닫기
            onMapClick?.(); // 부모 컴포넌트(PlanPage)에 선택 해제 알림
          }}
        >
          {plan && activeDay && (
            <>
              <MapViewport
                places={activeDay.places}
                selectedPlaceName={activePlaceName}
              />

              {path.length > 1 && <RoutePolyline path={path} />}

              {activeDay.places.map((place, idx) => {
                if (!place.location) return null;
                const isSelected = activePlaceName === place.placeName;

                return (
                  <Marker
                    key={`${activeDay.dayNumber}-${idx}`}
                    position={place.location}
                    title={place.placeName}
                    // 마커 클릭 시에는 이벤트 버블링으로 인한 지도 클릭(해제)을 방지할 필요는 없지만,
                    // 로직상 명확히 내부 state를 설정합니다.
                    onClick={() => {
                      setClickedPlaceName(place.placeName);
                    }}
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
                  onCloseClick={() => {
                    setClickedPlaceName(null);
                    onMapClick?.(); // X 버튼 클릭 시에도 완전 해제
                  }}
                  headerDisabled
                >
                  {/* [UPDATE] InfoWindow Card Shadow/Design */}
                  <div className="w-[220px] overflow-hidden rounded-lg bg-white font-sans shadow-md">
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
                          {activePlace.approxTime ? `${activePlace.approxTime} · ` : ""}
                          {activePlace.placeName}
                        </h3>
                        {activePlace.rating && (
                          <div className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-[#FF9A44]">
                            <span>★</span>
                            <span>{activePlace.rating}</span>
                          </div>
                        )}
                      </div>
                      {!!activePlace.hashtags?.length && (
                        <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[#FC6076]">
                          {activePlace.hashtags.slice(0, 3).join(" ")}
                        </p>
                      )}
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {activePlace.description}
                      </p>
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

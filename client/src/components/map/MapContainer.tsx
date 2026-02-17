import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// 도쿄 타워 근처 좌표 (기본 중심점)
const TOKYO_CENTER = { lat: 35.6586, lng: 139.7454 };

export const MapContainer = () => {
  if (!API_KEY) {
    return (
      <div className="p-4 text-red-500">Google Maps API Key가 없습니다.</div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] bg-gray-200 rounded-xl overflow-hidden shadow-lg relative">
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={TOKYO_CENTER}
          defaultZoom={13}
          gestureHandling={"greedy"} // 마우스 휠로 줌 가능하게 설정
          disableDefaultUI={true} // 기본 UI 제거 (깔끔하게)
        >
          {/* 테스트용 마커 (도쿄 타워) */}
          <Marker position={TOKYO_CENTER} />
        </Map>
      </APIProvider>

      {/* 지도 위에 떠있는 오버레이 예시 */}
      <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md z-10 font-bold text-primary">
        🗺️ TripFlow Map View
      </div>
    </div>
  );
};

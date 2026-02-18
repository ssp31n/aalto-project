// client/src/components/plan/ItineraryList.tsx
import { useEffect, useState } from "react";
import type { TravelPlan, Place } from "../../types/plan";
// 수정됨: PlaceDetails 앞에 'type' 키워드 추가
import { getPlaceDetails, type PlaceDetails } from "../../services/api";

interface ItineraryListProps {
  plan: TravelPlan;
}

// 개별 장소 카드 컴포넌트
const PlaceCard = ({ place, index }: { place: Place; index: number }) => {
  const [details, setDetails] = useState<PlaceDetails | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchInfo = async () => {
      if (!place.placeName) return;
      const data = await getPlaceDetails(place.placeName);
      if (isMounted) setDetails(data);
    };

    fetchInfo();
    return () => {
      isMounted = false;
    };
  }, [place.placeName]);

  return (
    <div className="bg-white rounded-xl p-0 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 relative group overflow-hidden">
      {/* 1. 이미지 표시 */}
      {details?.photoUrl && (
        <div className="h-32 w-full overflow-hidden relative">
          <img
            src={details.photoUrl}
            alt={place.placeName}
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        </div>
      )}

      {/* 2. 카드 내용 */}
      <div className="p-5">
        <div className="absolute left-0 top-6 w-1 h-8 bg-blue-500 rounded-r-full"></div>

        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">
              <span className="text-blue-500 font-mono text-sm">
                #{index + 1}
              </span>
              {place.placeName}
            </h3>
            {/* 별점 표시 */}
            {details?.rating && (
              <div className="flex items-center text-yellow-500 text-sm mt-1">
                {"★".repeat(Math.round(details.rating))}
                <span className="text-gray-400 ml-1 text-xs">
                  ({details.rating})
                </span>
              </div>
            )}
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded-full flex-shrink-0">
            {place.theme}
          </span>
        </div>

        <p className="text-gray-600 text-sm leading-relaxed mb-3">
          {place.description}
        </p>

        {/* 주소 표시 */}
        {details?.address && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            📍 {details.address}
          </p>
        )}
      </div>
    </div>
  );
};

export const ItineraryList = ({ plan }: ItineraryListProps) => {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="p-6 bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 leading-tight">
          {plan.title}
        </h2>
        <p className="text-gray-500 mt-2 text-sm">
          총 {plan.days.length}일간의 여정
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {plan.days.map((dayPlan) => (
          <div key={dayPlan.day} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg text-sm shadow-md">
                Day {dayPlan.day}
              </span>
              <div className="h-px bg-gray-300 flex-1"></div>
            </div>

            <div className="space-y-4">
              {dayPlan.places.map((place, index) => (
                <PlaceCard key={index} place={place} index={index} />
              ))}
            </div>
          </div>
        ))}
        <div className="h-10"></div>
      </div>
    </div>
  );
};

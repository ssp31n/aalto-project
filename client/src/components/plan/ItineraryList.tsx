// client/src/components/plan/ItineraryList.tsx
import type { TravelPlan, Place } from "../../types/plan";

interface ItineraryListProps {
  plan: TravelPlan;
  onPlaceClick: (placeName: string) => void; // 클릭 이벤트 추가
}

const PlaceCard = ({
  place,
  index,
  onClick,
}: {
  place: Place;
  index: number;
  onClick: () => void;
}) => {
  // 이제 fetch 로직 없음! 부모가 준 place 데이터를 그대로 씀.

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-0 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 relative group overflow-hidden cursor-pointer hover:border-blue-300"
    >
      {/* 이미지 */}
      {place.photoUrl && (
        <div className="h-32 w-full overflow-hidden relative">
          <img
            src={place.photoUrl}
            alt={place.placeName}
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}

      {/* 내용 */}
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
            {place.rating && (
              <div className="flex items-center text-yellow-500 text-sm mt-1">
                {"★".repeat(Math.round(place.rating))}
                <span className="text-gray-400 ml-1 text-xs">
                  ({place.rating})
                </span>
              </div>
            )}
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded-full flex-shrink-0">
            {place.theme}
          </span>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed">
          {place.description}
        </p>
      </div>
    </div>
  );
};

export const ItineraryList = ({ plan, onPlaceClick }: ItineraryListProps) => {
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
                <PlaceCard
                  key={index}
                  place={place}
                  index={index}
                  onClick={() => onPlaceClick(place.placeName)}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="h-10"></div>
      </div>
    </div>
  );
};

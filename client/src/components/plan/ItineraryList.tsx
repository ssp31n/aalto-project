// client/src/components/plan/ItineraryList.tsx
import type { TravelPlan } from "../../types/plan";

interface ItineraryListProps {
  plan: TravelPlan;
}

export const ItineraryList = ({ plan }: ItineraryListProps) => {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 여행 제목 헤더 */}
      <div className="p-6 bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 leading-tight">
          {plan.title}
        </h2>
        <p className="text-gray-500 mt-2 text-sm">
          총 {plan.days.length}일간의 여정
        </p>
      </div>

      {/* 일정 리스트 (스크롤 영역) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {plan.days.map((dayPlan) => (
          <div key={dayPlan.day} className="space-y-4">
            {/* Day 헤더 */}
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg text-sm shadow-md">
                Day {dayPlan.day}
              </span>
              <div className="h-px bg-gray-300 flex-1"></div>
            </div>

            {/* 장소 카드 리스트 */}
            <div className="space-y-4 pl-2">
              {dayPlan.places.map((place, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 relative group"
                >
                  {/* 순서 배지 (왼쪽 라인 연결 느낌) */}
                  <div className="absolute -left-3 top-6 w-6 h-6 bg-white border-2 border-blue-400 rounded-full flex items-center justify-center z-10">
                    <span className="text-xs font-bold text-blue-600">
                      {index + 1}
                    </span>
                  </div>

                  {/* 카드 내용 */}
                  <div className="ml-2">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                        {place.placeName}
                      </h3>
                      <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                        {place.theme}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {place.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 리스트 하단 여백 */}
        <div className="h-10"></div>
      </div>
    </div>
  );
};

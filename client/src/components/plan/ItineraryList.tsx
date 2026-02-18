import type { TravelPlan } from "../../types/plan";

interface ItineraryListProps {
  plan: TravelPlan;
  activeDayNumber: number;
  onDaySelect: (dayNumber: number) => void;
  onPlaceClick: (dayNumber: number, placeName: string) => void;
}

// accommodation 제거 (타입 불일치 해결)
const activityConfig: Record<
  "meal" | "sightseeing" | "activity",
  { label: string; color: string; bg: string }
> = {
  meal: { label: "Eat", color: "text-[#FC6076]", bg: "bg-[#FFF1F3]" },
  sightseeing: { label: "Visit", color: "text-[#FC6076]", bg: "bg-[#FFF1F3]" },
  activity: { label: "Play", color: "text-[#FF9A44]", bg: "bg-[#FFF4EA]" },
};

export const ItineraryList = ({
  plan,
  activeDayNumber,
  onDaySelect,
  onPlaceClick,
}: ItineraryListProps) => {
  const activeDay =
    plan.days.find((day) => day.dayNumber === activeDayNumber) ?? plan.days[0];

  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Title Header */}
      <div className="shrink-0 border-b border-slate-100 p-5 pb-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {plan.destination || "My Trip"}
        </h2>
        {/* plan.style 제거 */}
        <p className="text-sm text-slate-500">{plan.days.length} Days Trip</p>
      </div>

      {/* Sticky Day Tabs */}
      <div className="sticky top-0 z-20 shrink-0 bg-white/95 px-5 py-3 backdrop-blur-sm">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {plan.days.map((day) => {
            const isActive = day.dayNumber === activeDayNumber;
            return (
              <button
                key={day.dayNumber}
                onClick={() => onDaySelect(day.dayNumber)}
                className={`flex shrink-0 flex-col items-center rounded-2xl border px-4 py-2 transition-all ${
                  isActive
                    ? "border-[#FC6076] bg-[#FC6076] text-white shadow-md shadow-[#FC6076]/20"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-[#FFE7D4]" : "text-slate-400"}`}
                >
                  Day
                </span>
                <span className="text-lg font-bold leading-none">
                  {day.dayNumber}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-24 lg:pb-8">
        <div className="relative space-y-0">
          {/* Vertical Connecting Line */}
          <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-100" />

          {activeDay.places.map((place, index) => {
            // 타입 안전하게 접근
            const type = place.activityType as
              | "meal"
              | "sightseeing"
              | "activity";
            const config = activityConfig[type] || activityConfig.sightseeing;

            return (
              <div
                key={index}
                className="group relative flex gap-4 pb-8 last:pb-0"
              >
                {/* Timeline Node */}
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-4 border-white ${config.bg} ${config.color} shadow-sm`}
                  >
                    <span className="text-sm font-bold">{index + 1}</span>
                  </div>
                </div>

                {/* Card */}
                <button
                  onClick={() =>
                    onPlaceClick(activeDay.dayNumber, place.placeName)
                  }
                  className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition-all hover:border-[#FC6076]/30 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex w-full">
                    {place.photoUrl && (
                      <div className="w-24 shrink-0 bg-slate-100 sm:w-32">
                        <img
                          src={place.photoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex-1 p-3.5 min-w-0">
                      <div className="flex items-start justify-between">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.bg} ${config.color}`}
                        >
                          {config.label}
                        </span>
                        {place.rating && (
                          <div className="flex items-center gap-1 text-xs font-medium text-slate-700">
                            <span className="text-[#FF9A44]">★</span>
                            {place.rating.toFixed(1)}
                          </div>
                        )}
                      </div>

                      <h3 className="mt-1 font-bold text-slate-900 truncate">
                        {place.placeName}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {place.description}
                      </p>

                      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          🕓 {place.durationMin}m
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* End of Day Message */}
        <div className="mt-8 flex justify-center">
          <div className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-500">
            End of Day {activeDay.dayNumber}
          </div>
        </div>
      </div>
    </div>
  );
};

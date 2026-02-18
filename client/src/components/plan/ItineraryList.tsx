import type { Place, TravelPlan } from "../../types/plan";
import { MapIcon } from "../ui/icons";

interface ItineraryListProps {
  plan: TravelPlan;
  activeDayNumber: number;
  onDaySelect: (dayNumber: number) => void;
  onPlaceClick: (dayNumber: number, placeName: string) => void;
}

const activityLabelMap: Record<Place["activityType"], string> = {
  meal: "Meal",
  sightseeing: "Spot",
  activity: "Activity",
};

const StarRating = ({ rating }: { rating?: number }) => {
  if (!rating) return null;
  const rounded = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {Array.from({ length: rounded }).map((_, idx) => (
        <svg
          key={idx}
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5 fill-current"
          aria-hidden="true"
        >
          <path d="m10 1.8 2.4 4.8 5.3.8-3.8 3.8.9 5.3L10 14.1l-4.8 2.4.9-5.3L2.3 7.4l5.3-.8L10 1.8z" />
        </svg>
      ))}
      <span className="text-xs text-slate-500">{rating.toFixed(1)}</span>
    </div>
  );
};

export const ItineraryList = ({
  plan,
  activeDayNumber,
  onDaySelect,
  onPlaceClick,
}: ItineraryListProps) => {
  const activeDay =
    plan.days.find((day) => day.dayNumber === activeDayNumber) ??
    plan.days[0] ?? {
      dayNumber: 1,
      places: [],
    };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 px-4 py-4 md:px-6">
        <h2 className="text-xl font-semibold text-slate-900">{plan.title}</h2>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {plan.days.map((day) => {
            const active = day.dayNumber === activeDay.dayNumber;
            return (
              <button
                key={day.dayNumber}
                type="button"
                onClick={() => onDaySelect(day.dayNumber)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-sky-500 bg-sky-500 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                }`}
              >
                <MapIcon className="h-3.5 w-3.5" />
                Day {day.dayNumber}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid gap-3">
          {activeDay.places.map((place, index) => (
            <button
              key={`${activeDay.dayNumber}-${place.order}-${index}`}
              type="button"
              onClick={() => onPlaceClick(activeDay.dayNumber, place.placeName)}
              className="group relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {place.photoUrl ? (
                <img
                  src={place.photoUrl}
                  alt={place.placeName}
                  className="h-28 w-full object-cover"
                />
              ) : (
                <div className="h-28 w-full bg-gradient-to-r from-sky-100 to-cyan-100" />
              )}

              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                      {activityLabelMap[place.activityType]}
                    </p>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {index + 1}. {place.placeName}
                    </h3>
                  </div>
                  <StarRating rating={place.rating} />
                </div>
                <p className="line-clamp-2 text-xs text-slate-600">
                  {place.description}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{place.durationMin} min</span>
                  <span>
                    Day {activeDay.dayNumber} · Stop {index + 1}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

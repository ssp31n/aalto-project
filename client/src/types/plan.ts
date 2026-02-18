export type ActivityType = "meal" | "sightseeing" | "activity";

export interface Place {
  order: number;
  placeName: string;
  description: string;
  activityType: ActivityType;
  durationMin: number;
  googlePlaceId?: string;
  location?: {
    lat: number;
    lng: number;
  };
  photoUrl?: string;
  rating?: number;
  userRatingCount?: number;
  address?: string;
  hashtags?: string[];
  approxTime?: string;
}

export interface DayPlan {
  dayNumber: number;
  date?: string;
  places: Place[];
}

export interface TravelPlan {
  id?: string;
  title: string;
  days: DayPlan[];
  destination?: string;
}

const normalizeActivityType = (value: unknown): ActivityType => {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "meal" || raw === "sightseeing" || raw === "activity") return raw;
  if (
    raw.includes("식당") ||
    raw.includes("맛집") ||
    raw.includes("meal") ||
    raw.includes("restaurant") ||
    raw.includes("cafe")
  ) {
    return "meal";
  }
  if (raw.includes("체험") || raw.includes("activity")) return "activity";
  return "sightseeing";
};

const isAccommodationOrFlight = (placeObj: Record<string, unknown>) => {
  const text = `${String(placeObj.placeName ?? "")} ${String(placeObj.description ?? "")} ${String(
    placeObj.activityType ?? "",
  )}`.toLowerCase();
  return (
    text.includes("hotel") ||
    text.includes("hostel") ||
    text.includes("accommodation") ||
    text.includes("숙소") ||
    text.includes("flight") ||
    text.includes("airline") ||
    text.includes("항공") ||
    text.includes("airport")
  );
};

export const normalizeTravelPlan = (input: unknown): TravelPlan => {
  const raw = (input ?? {}) as Record<string, unknown>;
  const rawDays = Array.isArray(raw.days) ? raw.days : [];

  const days: DayPlan[] = rawDays.map((rawDay, dayIndex) => {
    const dayObj = (rawDay ?? {}) as Record<string, unknown>;
    const rawPlaces = Array.isArray(dayObj.places) ? dayObj.places : [];

    const places = rawPlaces.reduce<Place[]>((acc, rawPlace, placeIndex) => {
        const placeObj = (rawPlace ?? {}) as Record<string, unknown>;
        if (isAccommodationOrFlight(placeObj)) return acc;

        const rawDuration = Number(placeObj.durationMin ?? 90);

        const place: Place = {
          order: Number(placeObj.order ?? placeIndex),
          placeName: String(placeObj.placeName ?? "").trim(),
          description: String(placeObj.description ?? "").trim(),
          activityType: normalizeActivityType(placeObj.activityType ?? placeObj.theme),
          durationMin: Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 90,
          googlePlaceId:
            typeof placeObj.googlePlaceId === "string" ? placeObj.googlePlaceId : undefined,
          location:
            typeof placeObj.location === "object" &&
            placeObj.location !== null &&
            typeof (placeObj.location as { lat?: unknown }).lat === "number" &&
            typeof (placeObj.location as { lng?: unknown }).lng === "number"
              ? {
                  lat: (placeObj.location as { lat: number }).lat,
                  lng: (placeObj.location as { lng: number }).lng,
                }
              : undefined,
          photoUrl: typeof placeObj.photoUrl === "string" ? placeObj.photoUrl : undefined,
          rating: typeof placeObj.rating === "number" ? placeObj.rating : undefined,
          userRatingCount:
            typeof placeObj.userRatingCount === "number"
              ? placeObj.userRatingCount
              : undefined,
          address: typeof placeObj.address === "string" ? placeObj.address : undefined,
          hashtags:
            Array.isArray(placeObj.hashtags) &&
            placeObj.hashtags.every((item) => typeof item === "string")
              ? (placeObj.hashtags as string[]).slice(0, 4)
              : undefined,
          approxTime:
            typeof placeObj.approxTime === "string" ? placeObj.approxTime : undefined,
        };
        if (place.placeName.length > 0) acc.push(place);
        return acc;
      }, []);

    return {
      dayNumber: Number(dayObj.dayNumber ?? dayObj.day ?? dayIndex + 1),
      date: typeof dayObj.date === "string" ? dayObj.date : undefined,
      places,
    };
  });

  return {
    id: typeof raw.id === "string" ? raw.id : undefined,
    title: String(raw.title ?? "Untitled Trip"),
    destination: typeof raw.destination === "string" ? raw.destination : undefined,
    days,
  };
};

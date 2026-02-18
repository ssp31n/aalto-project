// client/src/types/plan.ts

export interface Place {
  placeName: string;
  description: string;
  theme: string;
  location?: { lat: number; lng: number };
  photoUrl?: string;
  rating?: number;
  address?: string;
}

export interface DayPlan {
  day: number;
  places: Place[];
}

export interface TravelPlan {
  title: string;
  days: DayPlan[];
  destination?: string;
}

import { normalizeTravelPlan, type TravelPlan } from "../types/plan";

const API_BASE_URL = "http://localhost:8000/api";

interface GeneratePlanParams {
  destination: string;
  days: number;
  companions: string;
  style: string;
  transportation: string;
  month: string;
  useWebSearch?: boolean;
}

export const generatePlan = async (
  params: GeneratePlanParams,
): Promise<TravelPlan> => {
  const response = await fetch(`${API_BASE_URL}/plans/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to generate travel plan.");
  }

  const data = await response.json();
  return normalizeTravelPlan(data);
};

export interface PlaceDetails {
  found: boolean;
  canonicalName?: string;
  address?: string;
  rating?: number;
  userRatingCount?: number;
  googlePlaceId?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  photoUrl?: string | null;
}

export const getPlaceDetailsBatch = async (
  placeNames: string[],
  destination = "",
): Promise<Record<string, PlaceDetails>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/get-place-details-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeNames, destination }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch place details batch");
    }

    const data = await response.json();
    return data.results ?? {};
  } catch (error) {
    console.error("API Error:", error);
    return {};
  }
};

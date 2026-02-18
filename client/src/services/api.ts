import type { TravelPlan } from "../types/plan"; // 'type' 키워드 추가

const API_BASE_URL = "http://localhost:8000/api";

interface GeneratePlanParams {
  destination: string;
  days: number;
  companions: string;
  style: string;
}

export const generatePlan = async (
  params: GeneratePlanParams,
): Promise<TravelPlan> => {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "여행 계획 생성에 실패했습니다.");
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export interface PlaceDetails {
  found: boolean;
  address?: string;
  rating?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  photoUrl?: string | null;
}

export const getPlaceDetails = async (
  placeName: string,
): Promise<PlaceDetails> => {
  try {
    const response = await fetch(`${API_BASE_URL}/get-place-details`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ placeName }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch place details");
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    // 에러 나도 전체 앱이 멈추지 않도록 빈 값 반환
    return { found: false };
  }
};

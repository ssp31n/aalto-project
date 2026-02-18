// client/src/services/api.ts
import type { TravelPlan } from "../types/plan";

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

// [수정됨] destination 인자 추가 (기본값 "")
export const getPlaceDetails = async (
  placeName: string,
  destination: string = "",
): Promise<PlaceDetails> => {
  try {
    // [핵심 수정] 검색어에 여행지 이름을 붙여서 정확도 향상
    // 예: "스타벅스" -> "스타벅스 in 오사카"
    const query = destination ? `${placeName} in ${destination}` : placeName;

    const response = await fetch(`${API_BASE_URL}/get-place-details`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // 서버는 placeName 필드를 기대하므로, 조작된 쿼리를 넣어서 보냄
      body: JSON.stringify({ placeName: query }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch place details");
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return { found: false };
  }
};

// client/src/pages/PlanPage.tsx
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { MapContainer } from "../components/map/MapContainer";
import { ItineraryList } from "../components/plan/ItineraryList"; // 새로 만든 컴포넌트 import
import { generatePlan } from "../services/api";
import type { TravelPlan } from "../types/plan";

const PlanPage = () => {
  const { logout, user } = useAuth();

  // 입력 상태
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(1);
  const [companions, setCompanions] = useState("친구");
  const [style, setStyle] = useState("맛집 탐방");

  // 결과 상태
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TravelPlan | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) return alert("여행지를 입력해주세요!");

    setLoading(true);
    setPlan(null);

    try {
      const result = await generatePlan({
        destination,
        days,
        companions,
        style,
      });
      setPlan(result);
    } catch (error) {
      console.error(error);
      alert("여행 계획 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* 상단 헤더 */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-20 flex-shrink-0">
        <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
          TripFlow{" "}
          <span className="text-sm font-normal text-gray-500">AI Planner</span>
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-600 text-sm">{user?.displayName}님</span>
          <button
            onClick={() => logout()}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* 좌측 패널 (Width 400px ~ 1/3) */}
        <div className="w-[400px] lg:w-1/3 min-w-[350px] bg-white border-r border-gray-200 flex flex-col shadow-xl z-10 transition-all duration-300">
          {/* 1. 결과가 없을 땐: 입력 폼 표시 */}
          {!plan && (
            <div className="p-8 h-full overflow-y-auto">
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  여행을 시작해볼까요?
                </h2>
                <p className="text-gray-500">
                  몇 가지 정보만 알려주시면 완벽한 계획을 제안해드려요.
                </p>
              </div>

              <form onSubmit={handleSearch} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    여행지
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="예: 오사카, 제주도, 파리"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      기간 (일)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      동행
                    </label>
                    <select
                      value={companions}
                      onChange={(e) => setCompanions(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white appearance-none"
                    >
                      <option value="혼자">혼자</option>
                      <option value="친구">친구</option>
                      <option value="연인">연인</option>
                      <option value="가족">가족</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    여행 스타일
                  </label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white appearance-none"
                  >
                    <option value="맛집 탐방">맛집 탐방 🍜</option>
                    <option value="힐링/휴양">힐링/휴양 🌿</option>
                    <option value="관광/역사">관광/역사 🏛️</option>
                    <option value="쇼핑">쇼핑 🛍️</option>
                    <option value="액티비티">액티비티 🏄</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transform transition-all duration-200 ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 hover:-translate-y-1"
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      AI가 여행 계획을 짜는 중...
                    </span>
                  ) : (
                    "여행 계획 생성하기 ✨"
                  )}
                </button>
              </form>
            </div>
          )}

          {/* 2. 결과가 있을 땐: 리스트 컴포넌트 표시 */}
          {plan && (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <button
                  onClick={() => setPlan(null)}
                  className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                >
                  ← 다시 입력하기
                </button>
              </div>
              <ItineraryList plan={plan} />
            </div>
          )}
        </div>

        {/* 우측 패널 (지도) */}
        <div className="flex-1 bg-gray-200 relative">
          <MapContainer />
          {/* 지도 위에 살짝 띄운 안내 문구 */}
          {!plan && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/5 pointer-events-none">
              <p className="text-gray-500 bg-white/80 px-4 py-2 rounded-full backdrop-blur-sm shadow-sm">
                🗺️ 여행지를 입력하면 지도가 움직입니다
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PlanPage;

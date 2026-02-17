// client/src/pages/PlanPage.tsx
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { MapContainer } from "../components/map/MapContainer";
import { generatePlan } from "../services/api";
import type { TravelPlan } from "../types/plan";

const PlanPage = () => {
  const { logout, user } = useAuth();

  // 입력 상태 관리
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(1);
  const [companions, setCompanions] = useState("친구");
  const [style, setStyle] = useState("맛집 탐방");

  // 로딩 및 결과 상태
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TravelPlan | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) return alert("여행지를 입력해주세요!");

    setLoading(true);
    setPlan(null); // 이전 결과 초기화

    try {
      console.log("요청 시작:", { destination, days, companions, style });
      const result = await generatePlan({
        destination,
        days,
        companions,
        style,
      });
      console.log("결과 수신:", result);
      setPlan(result);
    } catch (error) {
      console.error("Plan generation error:", error);
      alert(
        "여행 계획을 생성하는 중 오류가 발생했습니다. (백엔드 서버가 켜져 있는지 확인해주세요)",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 헤더 */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-20">
        <h1 className="text-xl font-bold text-primary">TripFlow ✈️</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-600 text-sm">{user?.displayName}님</span>
          <button
            onClick={() => logout()}
            className="text-sm text-red-500 hover:text-red-700"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* 좌측: 입력 폼 및 결과 패널 */}
        <div className="w-1/3 min-w-[400px] bg-white border-r border-gray-200 flex flex-col">
          {/* 입력 폼 영역 */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold mb-4">여행 계획 만들기</h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  어디로 떠나시나요?
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="예: 오사카, 제주도, 파리"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    기간 (일)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-md outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    누구와 함께?
                  </label>
                  <select
                    value={companions}
                    onChange={(e) => setCompanions(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md outline-none"
                  >
                    <option value="혼자">혼자</option>
                    <option value="친구">친구</option>
                    <option value="연인">연인</option>
                    <option value="가족">가족</option>
                    <option value="동료">동료</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  여행 스타일
                </label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md outline-none"
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
                className={`w-full py-3 rounded-lg text-white font-medium transition-all ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-md"
                }`}
              >
                {loading
                  ? "AI가 계획을 짜고 있어요... 🤖"
                  : "여행 계획 생성하기 ✨"}
              </button>
            </form>
          </div>

          {/* 결과 리스트 영역 (스크롤 가능) */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {plan ? (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 border-b pb-2">
                  {plan.title}
                </h3>
                {plan.days.map((dayPlan) => (
                  <div
                    key={dayPlan.day}
                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                  >
                    <h4 className="font-bold text-lg text-blue-600 mb-3">
                      Day {dayPlan.day}
                    </h4>
                    <ul className="space-y-4">
                      {dayPlan.places.map((place, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-gray-800">
                              {place.placeName}
                            </p>
                            <p className="text-sm text-gray-600">
                              {place.description}
                            </p>
                            <span className="text-xs inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded">
                              {place.theme}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                <div className="text-4xl">👆</div>
                <p>여행 정보를 입력하고 계획을 생성해보세요!</p>
              </div>
            )}
          </div>
        </div>

        {/* 우측: 지도 영역 */}
        <div className="flex-1 relative">
          <MapContainer />
        </div>
      </main>
    </div>
  );
};

export default PlanPage;

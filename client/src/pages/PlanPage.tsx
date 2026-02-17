// src/pages/PlanPage.tsx
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { MapContainer } from "../components/map/MapContainer";

const PlanPage = () => {
  const { logout, user } = useAuth();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 헤더 영역 */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-20">
        <h1 className="text-xl font-bold text-primary">TripFlow ✈️</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-600 text-sm">
            {user?.displayName || "여행자"}님
          </span>
          <button
            onClick={() => logout()}
            className="px-3 py-1.5 bg-red-50 text-red-500 rounded hover:bg-red-100 text-sm font-medium transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 (좌측: 패널 / 우측: 지도) */}
      <main className="flex-1 flex overflow-hidden">
        {/* 좌측: 여행 계획 패널 (나중에 채울 예정) */}
        <div className="w-1/3 min-w-[350px] bg-white border-r border-gray-200 p-6 overflow-y-auto">
          <h2 className="text-2xl font-bold mb-4">여행 계획</h2>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800 text-sm">
            Step 3: 우측에 지도가 보이고, 도쿄에 마커가 찍혀있나요? 🗼
          </div>

          {/* 임시 콘텐츠 */}
          <div className="mt-8 space-y-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-24 bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
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

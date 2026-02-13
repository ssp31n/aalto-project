import React from "react";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">
        {/* 로고 영역 (이모지로 대체) */}
        <div className="text-6xl mb-4">✈️</div>

        {/* 타이틀: Tailwind 설정의 'text-primary' 색상이 적용되어야 함 */}
        <h1 className="text-4xl font-bold text-primary mb-2">TripFlow Setup</h1>

        <p className="text-gray-600 mb-6">
          AI Travel Planner Project Initialized 🚀
        </p>

        {/* 상태 확인용 배지들 */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            React + Vite
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            Tailwind CSS v3
          </span>
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
            TypeScript
          </span>
        </div>

        <button className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md">
          Start Development
        </button>
      </div>

      <p className="mt-8 text-gray-400 text-sm">Step 1 Complete via Gemini</p>
    </div>
  );
}

export default App;

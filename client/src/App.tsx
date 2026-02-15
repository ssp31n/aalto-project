// src/App.tsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login"; // 이 파일이 존재하는지 꼭 확인해주세요!

// 보호된 라우트 컴포넌트: 로그인이 안 되어 있으면 로그인 페이지로 리다이렉트
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>; // 로딩 중 처리

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// 임시 홈 페이지 (로그인 후 화면)
const PlanPage = () => {
  const { logout, user } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary">My Trip Plans</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              안녕하세요, {user?.displayName}님!
            </span>
            <button
              onClick={() => logout()}
              className="px-4 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 text-sm font-medium"
            >
              로그아웃
            </button>
          </div>
        </header>
        <div className="bg-white p-12 rounded-xl shadow-sm text-center border border-gray-100">
          <p className="text-xl text-gray-500">
            아직 생성된 여행 계획이 없습니다.
          </p>
          <button className="mt-4 px-6 py-3 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 transition">
            + 새 여행 시작하기
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* 기본 경로는 로그인 페이지로 리다이렉트 */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* 로그인해야만 접근 가능한 페이지 */}
          <Route
            path="/plan"
            element={
              <ProtectedRoute>
                <PlanPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

// client/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import PlanPage from "./pages/PlanPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// 로그인 상태를 체크하여 접근을 제어하는 컴포넌트
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  // 인증 상태 확인 중일 때 로딩 표시
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  // 로그인이 안 되어 있으면 로그인 페이지로 튕겨내기
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 로그인 되어 있으면 자식 컴포넌트 보여주기
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* 1. 여행 계획 생성 페이지 (입력 폼) */}
          <Route
            path="/plan"
            element={
              <ProtectedRoute>
                <PlanPage />
              </ProtectedRoute>
            }
          />

          {/* 2. 여행 계획 상세 페이지 (결과 지도) */}
          <Route
            path="/plan/:planId"
            element={
              <ProtectedRoute>
                <PlanPage />
              </ProtectedRoute>
            }
          />

          {/* 3. 기본 접속 시 /plan으로 자동 이동 */}
          <Route path="/" element={<Navigate to="/plan" replace />} />

          {/* 4. 없는 페이지로 접근 시에도 /plan으로 이동 (404 처리) */}
          <Route path="*" element={<Navigate to="/plan" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

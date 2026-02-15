// client/src/pages/Login.tsx
// [Fix 3] 불필요한 'import React' 제거
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Login = () => {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      navigate("/plan");
    } catch (error) {
      // [Fix 4] error 변수를 사용(콘솔 출력)하거나, 사용하지 않을 거면 catch () 만 작성
      console.error("로그인 실패:", error);
      alert("로그인에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-primary mb-6">TripFlow</h1>
        <p className="text-gray-600 mb-8">AI와 함께 떠나는 나만의 여행 ✈️</p>

        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-all shadow-sm"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google G"
            className="w-6 h-6"
          />
          Google로 계속하기
        </button>
      </div>
    </div>
  );
};

export default Login;

// client/src/pages/PlanPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom"; // 라우터 훅 추가
import { useAuth } from "../contexts/AuthContext";
import { MapContainer } from "../components/map/MapContainer";
import { ItineraryList } from "../components/plan/ItineraryList";
import { generatePlan } from "../services/api";
import { savePlan, getPlan } from "../services/planService"; // 서비스 추가
import type { TravelPlan } from "../types/plan";

const PlanPage = () => {
  const { logout, user } = useAuth();
  const { planId } = useParams(); // URL 파라미터 확인
  const navigate = useNavigate();

  // 입력 상태
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(1);
  const [companions, setCompanions] = useState("친구");
  const [style, setStyle] = useState("맛집 탐방");

  // 결과 상태
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [saving, setSaving] = useState(false); // 저장 로딩 상태

  // 1. URL에 planId가 있으면 데이터 불러오기
  useEffect(() => {
    if (planId) {
      const fetchPlan = async () => {
        setLoading(true);
        try {
          const savedPlan = await getPlan(planId);
          setPlan(savedPlan);
        } catch (error) {
          console.error("Plan load error:", error); // 에러를 콘솔에 출력하여 사용 처리
          alert("여행 계획을 불러올 수 없습니다.");
          navigate("/plan");
        } finally {
          setLoading(false);
        }
      };
      fetchPlan();
    }
  }, [planId, navigate]);

  // 2. AI 여행 계획 생성
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
      alert("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Firestore에 저장하기
  const handleSave = async () => {
    if (!plan || !user) return;
    setSaving(true);
    try {
      const newPlanId = await savePlan(plan, user.uid);
      alert("여행 계획이 저장되었습니다! 💾");
      // 저장 후 해당 ID 페이지로 이동 (URL 변경)
      navigate(`/plan/${newPlanId}`);
    } catch (error) {
      console.error(error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-20 flex-shrink-0">
        <h1
          className="text-xl font-bold text-blue-600 flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/plan")}
        >
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
        <div className="w-[400px] lg:w-1/3 min-w-[350px] bg-white border-r border-gray-200 flex flex-col shadow-xl z-10 transition-all duration-300">
          {/* 로딩 중일 때 표시 */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-500">데이터를 불러오는 중입니다...</p>
            </div>
          )}

          {/* 계획이 없고 로딩도 아닐 때: 입력 폼 */}
          {!plan && !loading && (
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
                {/* (기존 입력 폼 코드와 동일 - 생략 없이 유지해주세요) */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    여행지
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="예: 오사카, 제주도"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      동행
                    </label>
                    <select
                      value={companions}
                      onChange={(e) => setCompanions(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="맛집 탐방">맛집 탐방 🍜</option>
                    <option value="힐링/휴양">힐링/휴양 🌿</option>
                    <option value="관광/역사">관광/역사 🏛️</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl text-white font-bold text-lg bg-blue-600 hover:bg-blue-700 transition-all shadow-lg"
                >
                  여행 계획 생성하기 ✨
                </button>
              </form>
            </div>
          )}

          {/* 계획이 있을 때: 리스트 + 저장 버튼 */}
          {plan && !loading && (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <button
                  onClick={() => {
                    setPlan(null);
                    navigate("/plan");
                  }} // 다시 입력하기 시 URL 초기화
                  className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
                >
                  ← 새 계획 만들기
                </button>

                {/* 저장 버튼 (이미 저장된 페이지라면 숨길 수도 있지만, 여기선 항상 노출 or disabled 처리 가능) */}
                {!planId ? (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow transition-colors flex items-center gap-2"
                  >
                    {saving ? "저장 중..." : "이 계획 저장하기 💾"}
                  </button>
                ) : (
                  <span className="text-xs text-green-600 font-bold px-2 py-1 bg-green-100 rounded">
                    저장됨 ✅
                  </span>
                )}
              </div>
              <ItineraryList plan={plan} />
            </div>
          )}
        </div>

        <div className="flex-1 bg-gray-200 relative">
          <MapContainer />
        </div>
      </main>
    </div>
  );
};

export default PlanPage;

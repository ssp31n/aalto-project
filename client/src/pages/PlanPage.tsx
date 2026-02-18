// client/src/pages/PlanPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { MapContainer } from "../components/map/MapContainer";
import { ItineraryList } from "../components/plan/ItineraryList";
import { generatePlan, getPlaceDetails } from "../services/api";
import { savePlan, getPlan } from "../services/planService";
import type { TravelPlan } from "../types/plan";

const PlanPage = () => {
  const { logout, user } = useAuth();
  const { planId } = useParams();
  const navigate = useNavigate();

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(1);
  const [companions, setCompanions] = useState("친구");
  const [style, setStyle] = useState("맛집 탐방");

  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);

  // [수정됨] city(여행지) 인자를 받도록 변경
  const enrichPlanData = async (basicPlan: TravelPlan, city: string) => {
    const newPlan = { ...basicPlan, days: [...basicPlan.days] };

    for (const day of newPlan.days) {
      day.places = await Promise.all(
        day.places.map(async (place) => {
          if (place.location) return place;

          // [수정됨] 장소 이름과 함께 'city(여행지)' 정보 전달
          const details = await getPlaceDetails(place.placeName, city);

          let formattedLocation = undefined;
          if (details.location) {
            formattedLocation = {
              lat: details.location.latitude,
              lng: details.location.longitude,
            };
          }

          return {
            ...place,
            location: formattedLocation,
            photoUrl: details.photoUrl || undefined,
            rating: details.rating,
            address: details.address,
          };
        }),
      );
    }
    return newPlan;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) return alert("여행지를 입력해주세요!");

    setLoading(true);
    setPlan(null);

    try {
      // 1) AI로 기본 텍스트 계획 생성
      const initialPlan = await generatePlan({
        destination,
        days,
        companions,
        style,
      });
      setPlan(initialPlan);

      // 2) 백그라운드에서 좌표 및 사진 데이터 로딩
      // [수정됨] 현재 입력된 destination 상태값을 함께 전달
      const richPlan = await enrichPlanData(initialPlan, destination);
      setPlan(richPlan);
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 저장된 계획 불러오기
  useEffect(() => {
    if (planId) {
      const fetchPlan = async () => {
        setLoading(true);
        try {
          const savedPlan = await getPlan(planId);
          setPlan(savedPlan);

          // 저장된 계획을 불러올 때도 enrichment 실행
          // (이미 저장된 데이터는 location이 있어서 API 호출을 건너뛰므로 빠름)
          // 저장된 plan 객체에 destination 필드가 있다면 그것을 쓰고, 없다면 빈 문자열
          // (Step 9 시점에서는 savedPlan에 destination 필드 저장을 명시하지 않았을 수 있으므로 안전하게 처리)
          // (savedPlan as any)를 제거하고 바로 접근
          const cityContext = savedPlan.destination || "";
          const richPlan = await enrichPlanData(savedPlan, cityContext);

          setPlan(richPlan);
        } catch (error) {
          console.error(error);
          alert("여행 계획을 불러올 수 없습니다.");
          navigate("/plan");
        } finally {
          setLoading(false);
        }
      };
      fetchPlan();
    }
  }, [planId, navigate]);

  const handleSave = async () => {
    if (!plan || !user) return;
    setSaving(true);
    try {
      // [참고] 저장 시 destination 정보도 함께 저장하면 나중에 불러올 때 유리함
      const planToSave = { ...plan, destination };
      const newPlanId = await savePlan(planToSave, user.uid);
      alert("여행 계획이 저장되었습니다! 💾");
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
          className="text-xl font-bold text-blue-600 cursor-pointer"
          onClick={() => navigate("/plan")}
        >
          TripFlow{" "}
          <span className="text-sm font-normal text-gray-500">AI Planner</span>
        </h1>
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

      <main className="flex-1 flex overflow-hidden relative">
        <div className="w-[400px] lg:w-1/3 min-w-[350px] bg-white border-r border-gray-200 flex flex-col shadow-xl z-10">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-500">여행 계획을 불러오는 중...</p>
            </div>
          )}

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
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    여행지
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none"
                    placeholder="예: 오사카, 제주도"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">
                      기간 (일)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">
                      동행
                    </label>
                    <select
                      value={companions}
                      onChange={(e) => setCompanions(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none"
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none"
                  >
                    <option value="맛집 탐방">맛집 탐방 🍜</option>
                    <option value="힐링/휴양">힐링/휴양 🌿</option>
                    <option value="관광/역사">관광/역사 🏛️</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl text-white font-bold text-lg bg-blue-600 hover:bg-blue-700 shadow-lg"
                >
                  여행 계획 생성하기 ✨
                </button>
              </form>
            </div>
          )}

          {plan && !loading && (
            <div className="flex-col h-full flex">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <button
                  onClick={() => {
                    setPlan(null);
                    navigate("/plan");
                  }}
                  className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
                >
                  ← 새 계획 만들기
                </button>
                {!planId ? (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg shadow"
                  >
                    {saving ? "저장 중..." : "저장하기 💾"}
                  </button>
                ) : (
                  <span className="text-xs text-green-600 font-bold px-2 py-1 bg-green-100 rounded">
                    저장됨 ✅
                  </span>
                )}
              </div>
              <ItineraryList plan={plan} onPlaceClick={setSelectedPlace} />
            </div>
          )}
        </div>

        <div className="flex-1 bg-gray-200 relative">
          <MapContainer plan={plan} selectedPlaceName={selectedPlace} />
        </div>
      </main>
    </div>
  );
};

export default PlanPage;

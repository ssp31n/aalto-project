import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ItineraryList } from "../components/plan/ItineraryList";
import {
  ListIcon,
  MapIcon,
  SparkIcon,
  ShareIcon,
  TrashIcon,
  SaveIcon,
  LogoutIcon,
  LoginIcon,
  ProgressIcon,
} from "../components/ui/icons";
import { useAuth } from "../contexts/useAuth";
import { generatePlan, getPlaceDetailsBatch } from "../services/api";
import {
  deletePlan,
  getPlan,
  listUserPlans,
  savePlan,
  type UserPlanSummary,
} from "../services/planService";
import type { Place, TravelPlan } from "../types/plan";
import { MapContainer } from "../components/map/MapContainer";

// --- Logic Helpers ---
const getDistanceKm = (a: Place, b: Place) => {
  if (!a.location || !b.location) return 1.2;
  const r = 6371;
  const dLat = ((b.location.lat - a.location.lat) * Math.PI) / 180;
  const dLon = ((b.location.lng - a.location.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.location.lat * Math.PI) / 180) *
      Math.cos((b.location.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return r * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
};

const routeDistanceScore = (arr: Place[]) => {
  let sum = 0;
  for (let i = 0; i < arr.length - 1; i++)
    sum += getDistanceKm(arr[i], arr[i + 1]);
  return sum;
};

const nearestNeighbor = (arr: Place[]) => {
  if (arr.length <= 2) return arr;
  const rest = [...arr];
  const result: Place[] = [rest.shift() as Place];
  while (rest.length) {
    const last = result[result.length - 1];
    let bestIdx = 0;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < rest.length; i++) {
      const d = getDistanceKm(last, rest[i]);
      if (d < best) {
        best = d;
        bestIdx = i;
      }
    }
    result.push(rest[bestIdx]);
    rest.splice(bestIdx, 1);
  }
  return result;
};

const twoOpt = (input: Place[]) => {
  if (input.length < 4) return input;
  let best = [...input];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 2; i++) {
      for (let k = i + 1; k < best.length - 1; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        if (routeDistanceScore(candidate) + 0.01 < routeDistanceScore(best)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
};

type MealType = "breakfast" | "lunch" | "dinner" | "meal";

const detectMealType = (place: Place): MealType => {
  if (place.activityType !== "meal") return "meal";
  const t = `${place.placeName} ${place.description}`.toLowerCase();
  if (/(breakfast|brunch|bakery|morning)/.test(t)) return "breakfast";
  if (/(lunch|bistro|deli|sandwich|noodle|ramen)/.test(t)) return "lunch";
  if (/(dinner|bbq|grill|steak|izakaya|bar|wine|night)/.test(t))
    return "dinner";
  return "meal";
};

const isMustVisitMeal = (place: Place) => {
  const t = `${place.placeName} ${place.description}`.toLowerCase();
  if (/(michelin|famous|signature|iconic|award|must-visit)/.test(t)) return true;
  return (place.rating ?? 0) >= 4.7 && (place.userRatingCount ?? 0) >= 1200;
};

const mealTemporalPenalty = (place: Place, idx: number, total: number) => {
  if (place.activityType !== "meal") return 0;
  const type = detectMealType(place);
  const lunchCenter = Math.round(total * 0.45);
  const dinnerMin = Math.max(2, Math.round(total * 0.65));
  if (type === "breakfast")
    return idx > Math.max(1, Math.round(total * 0.3)) ? 8 : 0;
  if (type === "lunch") return Math.abs(idx - lunchCenter) * 3;
  if (type === "dinner") return idx < dinnerMin ? (dinnerMin - idx) * 7 : 0;
  return Math.abs(idx - lunchCenter) * 2;
};

const bestInsertionIndex = (base: Place[], meal: Place) => {
  let bestIdx = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let idx = 0; idx <= base.length; idx++) {
    const prev = idx > 0 ? base[idx - 1] : null;
    const next = idx < base.length ? base[idx] : null;
    const distPenalty =
      (prev ? getDistanceKm(prev, meal) : 0) +
      (next ? getDistanceKm(meal, next) : 0) -
      (prev && next ? getDistanceKm(prev, next) : 0);

    const mustVisit = isMustVisitMeal(meal);
    const travelWeight = mustVisit ? 1.2 : 2.8;
    const temporal = mealTemporalPenalty(meal, idx, base.length + 1);
    const consecutiveMealPenalty =
      (prev?.activityType === "meal" ? 16 : 0) +
      (next?.activityType === "meal" ? 16 : 0);
    const score = distPenalty * travelWeight + temporal + consecutiveMealPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return bestIdx;
};

const optimizeRoute = (places: Place[]): Place[] => {
  if (places.length <= 2) return places.map((p, i) => ({ ...p, order: i }));

  const withLoc = places.filter((p) => p.location);
  const noLoc = places.filter((p) => !p.location);
  const meals = withLoc.filter((p) => p.activityType === "meal");
  const nonMeals = withLoc.filter((p) => p.activityType !== "meal");

  let route =
    nonMeals.length > 1 ? twoOpt(nearestNeighbor(nonMeals)) : [...nonMeals];
  const orderedMeals = [...meals].sort((a, b) => {
    const rank = (x: Place) =>
      detectMealType(x) === "breakfast"
        ? 0
        : detectMealType(x) === "lunch"
          ? 1
          : detectMealType(x) === "dinner"
            ? 2
            : 3;
    return rank(a) - rank(b);
  });

  for (const meal of orderedMeals) {
    const idx = bestInsertionIndex(route, meal);
    route.splice(idx, 0, meal);
  }

  route = twoOpt(route);
  return [...route, ...noLoc].map((p, i) => ({ ...p, order: i }));
};

const toHHMM = (minutesFromMidnight: number) => {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const applyApproxTimes = (places: Place[]) => {
  let current = 9 * 60;
  return places.map((place, idx) => {
    const withTime = { ...place, approxTime: toHHMM(current) };
    const next = places[idx + 1];
    const transferMin = next
      ? Math.max(10, Math.min(35, Math.round(getDistanceKm(place, next) * 6)))
      : 0;
    current += (place.durationMin || 90) + transferMin;
    return withTime;
  });
};
// --------------------

const PlanPage = () => {
  const { user, logout } = useAuth();
  const { planId } = useParams();
  const navigate = useNavigate();

  const [mobileView, setMobileView] = useState<"itinerary" | "map">(
    "itinerary",
  );

  // Form State
  const [destination, setDestination] = useState("");

  // Date Picker State (YYYY-MM-DD string)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [companions, setCompanions] = useState("friends");
  const [style, setStyle] = useState("food");
  const [transportation, setTransportation] = useState("public");

  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [userPlans, setUserPlans] = useState<UserPlanSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [activeDayNumber, setActiveDayNumber] = useState(1);

  // Carousel Refs for scrolling interaction
  const carouselRef = useRef<HTMLDivElement>(null);

  // 현재 날짜 (min date 설정용)
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (user) {
      listUserPlans(user.uid).then(setUserPlans).catch(console.error);
    } else {
      setUserPlans([]);
    }
  }, [user]);

  const enrichAndOptimizePlan = async (basePlan: TravelPlan, city: string) => {
    const nextPlan = { ...basePlan, days: [...basePlan.days] };
    const unresolved = Array.from(
      new Set(
        nextPlan.days.flatMap((day) =>
          day.places
            .filter((place) => !place.location)
            .map((place) => place.placeName),
        ),
      ),
    );
    const detailMap = unresolved.length
      ? await getPlaceDetailsBatch(unresolved, city)
      : {};

    for (const day of nextPlan.days) {
      const enriched = day.places.map((place) => {
        const details = detailMap[place.placeName];
        if (!details?.found) return place;
        return {
          ...place,
          placeName: details.canonicalName || place.placeName,
          location: details.location
            ? {
                lat: details.location.latitude,
                lng: details.location.longitude,
              }
            : place.location,
          photoUrl: details.photoUrl || place.photoUrl,
          rating: details.rating,
          userRatingCount: details.userRatingCount,
          googlePlaceId: details.googlePlaceId,
          address: details.address,
          hashtags:
            details.hashtags && details.hashtags.length > 0
              ? details.hashtags
              : place.hashtags,
        };
      });
      day.places = applyApproxTimes(optimizeRoute(enriched));
    }
    return nextPlan;
  };

  useEffect(() => {
    if (!planId) return;
    const load = async () => {
      setLoading(true);
      try {
        const savedPlan = await getPlan(planId);
        const city = savedPlan.destination || "";
        const enriched = await enrichAndOptimizePlan(savedPlan, city);
        setPlan(enriched);
        setDestination(city);
        setActiveDayNumber(1);
      } catch (e) {
        console.error(e);
        alert("Failed to load plan");
        navigate("/plan");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [planId, navigate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return alert("Where to?");
    if (!startDate || !endDate) return alert("Please select travel dates.");

    setLoading(true);
    setPlan(null);

    // [Logic] Calculate duration & month
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (durationDays < 1) {
      setLoading(false);
      return alert("End date must be after start date.");
    }
    if (durationDays > 14) {
      setLoading(false);
      return alert(
        "Currently, trips are limited to 14 days for best AI performance.",
      );
    }

    // Extract Month (1-12 string)
    const monthStr = parseInt(startDate.split("-")[1], 10).toString();

    try {
      const initialPlan = await generatePlan({
        destination,
        days: durationDays,
        companions,
        style,
        transportation,
        month: monthStr,
        useWebSearch: false,
      });
      const finalPlan = await enrichAndOptimizePlan(initialPlan, destination);
      setPlan(finalPlan);
      setActiveDayNumber(1);
      setMobileView("itinerary");
    } catch (e) {
      console.error(e);
      alert("Error generating plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !plan) return;
    setSaving(true);
    try {
      const id = await savePlan({ ...plan, destination }, user.uid);
      const list = await listUserPlans(user.uid);
      setUserPlans(list);
      alert("Plan saved!");
      navigate(`/plan/${id}`);
    } catch (e) {
      console.error(e);
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this plan?")) return;
    try {
      await deletePlan(id);
      const list = await listUserPlans(user!.uid);
      setUserPlans(list);
      if (planId === id) {
        setPlan(null);
        navigate("/plan");
      }
    } catch (e) {
      console.error(e);
      alert("Delete failed");
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    } catch (e) {
      console.error(e);
    }
  };

  // ✅ [NEW] 장소 1개만 삭제 (plan state에서만 제거)
  const handleDeletePlace = (dayNumber: number, placeIndex: number) => {
    if (!plan) return;

    const ok = window.confirm("Remove this place from the itinerary?");
    if (!ok) return;

    setPlan((prev) => {
      if (!prev) return prev;

      const day = prev.days.find((d) => d.dayNumber === dayNumber);
      const deletedName = day?.places?.[placeIndex]?.placeName ?? null;

      const next: TravelPlan = {
        ...prev,
        days: prev.days.map((d) => {
          if (d.dayNumber !== dayNumber) return d;
          const nextPlaces = d.places.filter((_, idx) => idx !== placeIndex);
          // 삭제 후 시간 표시도 자연스럽게 이어지게 재계산만 (루트 재최적화는 안 함: 최소 변경)
          return { ...d, places: applyApproxTimes(nextPlaces) };
        }),
      };

      // 지도에서 선택 중인 장소가 삭제되면 선택 해제
      if (deletedName && selectedPlace === deletedName) {
        setSelectedPlace(null);
      }

      return next;
    });
  };

  // --- Memoized Helpers for Map & Carousel ---
  const activeDayForMap = useMemo(() => {
    return (
      plan?.days.find((d) => d.dayNumber === activeDayNumber) ??
      plan?.days[0] ??
      null
    );
  }, [plan, activeDayNumber]);

  const placesForCarousel = useMemo(
    () => activeDayForMap?.places ?? [],
    [activeDayForMap],
  );

  const isOwner = user && userPlans.some((p) => p.id === planId);

  // 스크롤 동기화: 지도의 핀을 클릭했을 때 (selectedPlace 변경 시) 가로 스크롤 이동
  useEffect(() => {
    if (!selectedPlace || !carouselRef.current) return;
    const index = placesForCarousel.findIndex(
      (p) => p.placeName === selectedPlace,
    );
    if (index !== -1) {
      const card = carouselRef.current.children[index] as HTMLElement;
      if (card) {
        card.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [selectedPlace, placesForCarousel]);

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="glass sticky top-0 z-50 shrink-0 px-4">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between">
          <div
            onClick={() => navigate("/plan")}
            className="flex cursor-pointer items-center gap-2"
          >
            <img
              src="/icon.svg"
              alt="triplo"
              className="h-8 w-8 rounded-lg shadow-sm"
            />
            <span className="text-lg font-bold tracking-tight text-slate-900">
              triplo
            </span>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <button
                onClick={logout}
                className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                title="Logout"
              >
                <LogoutIcon className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-1 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <LoginIcon className="h-3.5 w-3.5" /> Log in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        {!plan && !loading ? (
          <div className="h-full w-full overflow-y-auto px-4 py-8 custom-scrollbar">
            {/* ... (Search Form - 동일) ... */}
            <div className="mx-auto max-w-lg space-y-8 pb-20">
              <div className="text-center">
                <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
                  Where next?
                </h1>
                <p className="mt-2 text-slate-500">
                  AI-powered itineraries, optimized for you.
                </p>
              </div>

              <form
                onSubmit={handleSearch}
                className="glass space-y-5 rounded-3xl p-6 ring-1 ring-slate-200/50"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Destination
                  </label>
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Kyoto, Paris"
                    className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3.5 text-lg font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#FC6076]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (endDate && e.target.value > endDate) {
                          setEndDate("");
                        }
                      }}
                      className="w-full min-w-0 rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-[#FC6076]"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      min={startDate || todayStr}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full min-w-0 rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-[#FC6076]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Who
                    </label>
                    <select
                      value={companions}
                      onChange={(e) => setCompanions(e.target.value)}
                      className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[#FC6076]"
                    >
                      <option value="solo">Solo</option>
                      <option value="couple">Couple</option>
                      <option value="friends">Friends</option>
                      <option value="family">Family</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Style
                    </label>
                    <select
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[#FC6076]"
                    >
                      <option value="food">Gourmet</option>
                      <option value="relax">Chill</option>
                      <option value="culture">History</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Transport
                  </label>
                  <select
                    value={transportation}
                    onChange={(e) => setTransportation(e.target.value)}
                    className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[#FC6076]"
                  >
                    <option value="public">Public / Walk</option>
                    <option value="car">Rental Car</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF9A44] to-[#FC6076] py-4 text-base font-bold text-white shadow-lg shadow-[#FC6076]/30 transition active:scale-[0.98] disabled:opacity-70 hover:brightness-95"
                >
                  <SparkIcon className="h-5 w-5" />
                  Generate Trip
                </button>
              </form>

              {userPlans.length > 0 && (
                <div className="pt-4">
                  <h3 className="mb-3 px-1 text-sm font-bold text-slate-900">
                    Recent Plans
                  </h3>
                  <div className="space-y-3">
                    {userPlans.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => navigate(`/plan/${p.id}`)}
                        className="glass flex cursor-pointer items-center justify-between rounded-xl p-4 transition hover:bg-white"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {p.destination || "Trip"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.daysCount} days · {p.title}
                          </p>
                        </div>
                        <div className="text-slate-300">→</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
            <div className="relative mb-8 h-20 w-20">
              <div className="absolute inset-0 animate-ping rounded-full bg-[#FFE7D4]"></div>
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-[#FFF1F3] text-[#FC6076] shadow-xl shadow-[#FC6076]/20">
                <ProgressIcon className="h-10 w-10 animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              Designing your {destination} trip...
            </h2>
            <p className="mt-2 text-slate-500">
              Selecting best spots & optimizing routes
            </p>
          </div>
        ) : (
          /* RESULT VIEW */
          <div className="flex h-full min-h-0 w-full flex-col lg:flex-row">
            {/* Left: Itinerary List */}
            <div
              className={`
                ${mobileView === "map" ? "hidden" : "flex"} 
                min-h-0 flex-1 flex-col bg-white lg:flex lg:w-[450px] lg:max-w-[450px] lg:flex-none lg:border-r lg:border-slate-200 lg:shadow-xl z-10
              `}
            >
              <ItineraryList
                plan={plan!}
                activeDayNumber={activeDayNumber}
                onDaySelect={setActiveDayNumber}
                onPlaceClick={(d, name) => {
                  setActiveDayNumber(d);
                  setSelectedPlace(name);
                  if (window.innerWidth < 1024) {
                    setMobileView("map");
                  }
                }}
                onPlaceDelete={handleDeletePlace} // ✅ 추가
              />
            </div>

            {/* Right: Map */}
            <div
              className={`
                ${mobileView === "itinerary" ? "hidden lg:block" : "block"} 
                relative min-h-0 flex-1 bg-slate-100
              `}
            >
              <MapContainer
                plan={plan!}
                activeDayNumber={activeDayForMap?.dayNumber || 1}
                selectedPlaceName={selectedPlace}
                emptyKeyMessage="Map key missing"
                // [수정] 지도 빈 공간 클릭 시 선택 해제 (MapContainer 내부 구현 필요)
                onMapClick={() => setSelectedPlace(null)}
              />

              {/* [NEW] Mobile Map Bottom Carousel (Sliding List) */}
              <div
                className="lg:hidden absolute bottom-28 left-0 right-0 z-20 flex gap-3 overflow-x-auto px-4 pb-4 snap-x no-scrollbar"
                ref={carouselRef}
              >
                {placesForCarousel.map((place, idx) => {
                  const isSelected = selectedPlace === place.placeName;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedPlace(place.placeName)}
                      className={`
                          shrink-0 snap-center flex w-[85vw] max-w-[320px] items-center gap-3 rounded-xl p-3 transition-all cursor-pointer border-2
                          ${
                            isSelected
                              ? "border-[#FC6076] shadow-xl shadow-[#FC6076]/20 bg-white scale-[1.02]"
                              : "border-transparent shadow-md bg-white/95 text-slate-500"
                          }
                        `}
                    >
                      {/* Photo */}
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {place.photoUrl ? (
                          <img
                            src={place.photoUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                            No Img
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${
                              isSelected ? "bg-[#FC6076]" : "bg-slate-400"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <h4
                            className={`truncate text-sm font-bold ${
                              isSelected ? "text-slate-900" : "text-slate-700"
                            }`}
                          >
                            {place.placeName}
                          </h4>
                        </div>
                        {place.approxTime && (
                          <p className="mt-0.5 inline-flex w-fit items-center rounded-md bg-[#FFF4EA] px-2 py-0.5 text-[11px] font-semibold text-[#FF9A44]">
                            {place.approxTime}
                          </p>
                        )}
                        {!!place.hashtags?.length && (
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-[#FC6076]">
                            {place.hashtags.slice(0, 2).join(" ")}
                          </p>
                        )}
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {place.description}
                        </p>
                        {place.rating && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-[#FF9A44] font-bold">
                            <span>★ {place.rating}</span>
                            <span className="text-slate-300">
                              ({place.userRatingCount})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Floating Action Buttons */}
              <div className="absolute right-4 top-4 flex flex-col gap-2 z-10">
                {planId && (
                  <button
                    onClick={handleShare}
                    className="glass rounded-full p-3 text-slate-700 transition hover:scale-110 active:scale-90"
                    title="Share Plan"
                  >
                    <ShareIcon className="h-5 w-5" />
                  </button>
                )}
                {isOwner && planId && (
                  <button
                    onClick={() => handleDelete(planId)}
                    className="glass rounded-full p-3 text-[#FC6076] transition hover:scale-110 active:scale-90"
                    title="Delete Plan"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
              </div>

              {user && !planId && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="absolute right-4 bottom-28 lg:bottom-8 z-20 hidden items-center gap-2 rounded-full bg-gradient-to-r from-[#FF9A44] to-[#FC6076] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#FC6076]/30 transition hover:scale-105 hover:brightness-95 active:scale-95 lg:flex"
                >
                  <SaveIcon className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Plan"}
                </button>
              )}

              {/* Mobile Save Button */}
              {user && !planId && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="absolute right-4 top-20 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[#FF9A44] to-[#FC6076] text-white shadow-lg transition hover:brightness-95 active:scale-90 lg:hidden"
                >
                  <SaveIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Mobile Bottom Toggle */}
            <div className="absolute bottom-8 left-1/2 z-40 flex -translate-x-1/2 lg:hidden">
              <div className="glass flex items-center rounded-full p-1.5 ring-1 ring-slate-200/50">
                <button
                  onClick={() => setMobileView("itinerary")}
                  className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all ${
                    mobileView === "itinerary"
                      ? "bg-gradient-to-r from-[#FF9A44] to-[#FC6076] text-white shadow-lg shadow-[#FC6076]/20"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <ListIcon className="h-4 w-4" />
                  List
                </button>
                <button
                  onClick={() => setMobileView("map")}
                  className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all ${
                    mobileView === "map"
                      ? "bg-gradient-to-r from-[#FF9A44] to-[#FC6076] text-white shadow-lg shadow-[#FC6076]/20"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <MapIcon className="h-4 w-4" />
                  Map
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PlanPage;
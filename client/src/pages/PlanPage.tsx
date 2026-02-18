import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ItineraryList } from "../components/plan/ItineraryList";
import {
  TrashIcon,
  ListIcon,
  LoginIcon,
  LogoutIcon,
  MapIcon,
  ProgressIcon,
  SaveIcon,
  ShareIcon,
  SparkIcon,
} from "../components/ui/icons";
import { useAuth } from "../contexts/AuthContext";
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

const getDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
};

const routeDistance = (places: Place[]) => {
  let sum = 0;
  for (let i = 0; i < places.length - 1; i++) {
    const a = places[i].location;
    const b = places[i + 1].location;
    if (!a || !b) continue;
    sum += getDistance(a.lat, a.lng, b.lat, b.lng);
  }
  return sum;
};

const nearestNeighbor = (places: Place[]): Place[] => {
  const arr = [...places];
  const path: Place[] = [arr.shift()!];

  while (arr.length) {
    const current = path[path.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < arr.length; i++) {
      const d = getDistance(
        current.location!.lat,
        current.location!.lng,
        arr[i].location!.lat,
        arr[i].location!.lng,
      );
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    path.push(arr[bestIdx]);
    arr.splice(bestIdx, 1);
  }

  return path;
};

const twoOpt = (input: Place[]): Place[] => {
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

        if (routeDistance(candidate) + 0.001 < routeDistance(best)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }

  return best;
};

type MealType = "breakfast" | "lunch" | "dinner" | "meal";

const BREAKFAST_HINTS = ["breakfast", "brunch", "bakery", "coffee", "cafe", "아침"];
const LUNCH_HINTS = ["lunch", "bistro", "deli", "sandwich", "noodle", "ramen", "점심"];
const DINNER_HINTS = [
  "dinner",
  "supper",
  "bbq",
  "grill",
  "steak",
  "izakaya",
  "bar",
  "wine",
  "fine dining",
  "저녁",
];

const countHints = (text: string, hints: string[]) =>
  hints.reduce((acc, hint) => acc + (text.includes(hint) ? 1 : 0), 0);

const inferMealType = (place: Place): MealType => {
  if (place.activityType !== "meal") return "meal";
  const text = `${place.placeName} ${place.description}`.toLowerCase();
  const breakfastScore = countHints(text, BREAKFAST_HINTS);
  const lunchScore = countHints(text, LUNCH_HINTS);
  const dinnerScore = countHints(text, DINNER_HINTS);

  if (breakfastScore === 0 && lunchScore === 0 && dinnerScore === 0) return "meal";
  if (dinnerScore >= lunchScore && dinnerScore >= breakfastScore) return "dinner";
  if (lunchScore >= breakfastScore) return "lunch";
  if (breakfastScore > 0) return "breakfast";
  return "meal";
};

const temporalPenalty = (route: Place[]) => {
  const n = route.length;
  if (n === 0) return 0;

  const mealIndices = route
    .map((place, idx) => ({ place, idx }))
    .filter(({ place }) => place.activityType === "meal");

  let penalty = 0;
  let prevMeal = false;

  for (let i = 0; i < n; i++) {
    const place = route[i];
    const isMeal = place.activityType === "meal";

    if (isMeal && prevMeal) penalty += 10;
    prevMeal = isMeal;
    if (!isMeal) continue;

    const mealType = inferMealType(place);
    const earlyThreshold = Math.max(1, Math.floor(n * 0.22));
    const lunchStart = Math.floor(n * 0.28);
    const lunchEnd = Math.ceil(n * 0.72);
    const dinnerStart = Math.max(2, Math.floor(n * 0.6));
    const mealOrder = mealIndices.findIndex((item) => item.idx === i);
    const mealCount = mealIndices.length;
    const genericExpected = Math.round(((mealOrder + 1) * (n - 1)) / (mealCount + 1));

    if (mealType === "dinner") {
      if (i < dinnerStart) penalty += (dinnerStart - i) * 22;
      if (i <= 1) penalty += 45;
    } else if (mealType === "lunch") {
      if (i < lunchStart) penalty += (lunchStart - i) * 14;
      if (i > lunchEnd) penalty += (i - lunchEnd) * 10;
    } else if (mealType === "breakfast") {
      if (i > earlyThreshold) penalty += (i - earlyThreshold) * 12;
    } else {
      penalty += Math.abs(i - genericExpected) * 8;
      if (mealCount >= 2 && mealOrder === mealCount - 1 && i < dinnerStart) {
        penalty += (dinnerStart - i) * 12;
      }
      if (i <= 1) penalty += 10;
    }
  }

  return penalty;
};

const routeScore = (route: Place[]) => routeDistance(route) + temporalPenalty(route);

const moveItem = (arr: Place[], from: number, to: number) => {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const improveTemporalOrder = (route: Place[]) => {
  if (route.length <= 2) return route;
  let best = [...route];
  let bestScore = routeScore(best);

  let improved = true;
  let guard = 0;
  while (improved && guard < 8) {
    guard += 1;
    improved = false;
    for (let i = 0; i < best.length; i++) {
      if (best[i].activityType !== "meal") continue;

      for (let j = 0; j < best.length; j++) {
        if (i === j) continue;
        const candidate = moveItem(best, i, j);
        const score = routeScore(candidate);
        if (score + 0.01 < bestScore) {
          best = candidate;
          bestScore = score;
          improved = true;
        }
      }
    }
  }

  return best;
};

const optimizeRoute = (places: Place[]): Place[] => {
  if (places.length <= 2) {
    return places.map((p, i) => ({ ...p, order: i }));
  }

  const withLocation = places.filter((p) => p.location);
  const withoutLocation = places.filter((p) => !p.location);

  if (withLocation.length <= 2) {
    return [...withLocation, ...withoutLocation].map((p, i) => ({ ...p, order: i }));
  }

  let bestPath: Place[] = withLocation;
  let bestCost = Infinity;

  for (let start = 0; start < withLocation.length; start++) {
    const rotated = [...withLocation.slice(start), ...withLocation.slice(0, start)];
    const nn = nearestNeighbor(rotated);
    const improved = twoOpt(nn);
    const cost = routeDistance(improved);
    if (cost < bestCost) {
      bestCost = cost;
      bestPath = improved;
    }
  }

  const temporallyImproved = improveTemporalOrder(bestPath);

  return [...temporallyImproved, ...withoutLocation].map((place, index) => ({
    ...place,
    order: index,
  }));
};

const PlanPage = () => {
  const { user, logout } = useAuth();
  const { planId } = useParams();
  const navigate = useNavigate();

  const [mobileView, setMobileView] = useState<"itinerary" | "map">("itinerary");

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(1);
  const [companions, setCompanions] = useState("friends");
  const [style, setStyle] = useState("food");
  const [transportation, setTransportation] = useState("public");
  const [month, setMonth] = useState("5");

  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);

  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [userPlans, setUserPlans] = useState<UserPlanSummary[]>([]);

  const [saving, setSaving] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [activeDayNumber, setActiveDayNumber] = useState(1);

  const loadingHints = useMemo(
    () => [
      "Collecting day-by-day places",
      "Validating real map locations",
      "Optimizing route order",
    ],
    [],
  );
  const travelTips = useMemo(
    () => [
      "Tip: Keep the first stop close to your hotel area to reduce day-one fatigue.",
      "Tip: Group landmarks by district, then place meals between district moves.",
      "Tip: If weather changes, swap indoor spots into the same time slot.",
      "Tip: Leave 15–20 minutes buffer between nearby stops.",
      "Tip: Save your plan once route quality looks right, then share it.",
    ],
    [],
  );

  useEffect(() => {
    if (!loading) return;

    setLoadingPhase(0);

    const phaseTimer = setInterval(() => {
      setLoadingPhase((prev) => (prev + 1) % loadingHints.length);
    }, 4200);

    return () => {
      clearInterval(phaseTimer);
    };
  }, [loading, loadingHints.length]);

  useEffect(() => {
    if (!user) {
      setUserPlans([]);
      return;
    }

    listUserPlans(user.uid)
      .then(setUserPlans)
      .catch((error) => console.error("Failed to list user plans", error));
  }, [user]);

  const enrichAndOptimizePlan = async (basePlan: TravelPlan, city: string) => {
    const nextPlan = { ...basePlan, days: [...basePlan.days] };

    const unresolved = Array.from(
      new Set(
        nextPlan.days.flatMap((day) =>
          day.places.filter((place) => !place.location).map((place) => place.placeName),
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
            ? { lat: details.location.latitude, lng: details.location.longitude }
            : place.location,
          photoUrl: details.photoUrl || place.photoUrl,
          rating: details.rating,
          userRatingCount: details.userRatingCount,
          googlePlaceId: details.googlePlaceId,
          address: details.address,
        };
      });

      day.places = optimizeRoute(enriched);
    }

    return nextPlan;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      alert("Please enter a destination.");
      return;
    }

    setLoading(true);
    setPlan(null);

    try {
      const initialPlan = await generatePlan({
        destination,
        days,
        companions,
        style,
        transportation,
        month,
        useWebSearch: false,
      });

      const enrichedPlan = await enrichAndOptimizePlan(initialPlan, destination);
      setPlan(enrichedPlan);
      setActiveDayNumber(enrichedPlan.days[0]?.dayNumber ?? 1);
      setSelectedPlace(null);
      setMobileView("itinerary");
    } catch (error) {
      console.error(error);
      alert("Failed to generate plan.");
    } finally {
      setTimeout(() => setLoading(false), 220);
    }
  };

  useEffect(() => {
    if (!planId) return;

    const fetchPlan = async () => {
      setLoading(true);
      try {
        const savedPlan = await getPlan(planId);
        const city = savedPlan.destination || "";
        const enriched = await enrichAndOptimizePlan(savedPlan, city);
        setPlan(enriched);
        setDestination(city);
        setActiveDayNumber(enriched.days[0]?.dayNumber ?? 1);
      } catch (error) {
        console.error(error);
        alert("Unable to load this plan.");
        navigate("/plan");
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [planId, navigate]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Share link copied.");
    } catch (error) {
      console.error(error);
    }
  };

  const handleSave = async () => {
    if (!plan || !user) return;

    setSaving(true);
    try {
      const id = await savePlan({ ...plan, destination }, user.uid);
      const list = await listUserPlans(user.uid);
      setUserPlans(list);
      alert("Plan saved.");
      navigate(`/plan/${id}`);
    } catch (error) {
      console.error(error);
      alert("Failed to save plan.");
    } finally {
      setSaving(false);
    }
  };

  const activeDayForMap = plan?.days.find((d) => d.dayNumber === activeDayNumber)
    ? activeDayNumber
    : (plan?.days[0]?.dayNumber ?? 1);
  const isOwnedCurrentPlan =
    Boolean(user && planId) && userPlans.some((item) => item.id === planId);

  const handleDeletePlan = async (targetPlanId: string) => {
    if (!user) return;
    const ok = window.confirm("Delete this plan? This action cannot be undone.");
    if (!ok) return;

    try {
      await deletePlan(targetPlanId);
      const refreshed = await listUserPlans(user.uid);
      setUserPlans(refreshed);

      if (planId === targetPlanId) {
        setPlan(null);
        setSelectedPlace(null);
        navigate("/plan", { replace: true });
      }
    } catch (error) {
      console.error(error);
      alert("Failed to delete plan.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 md:px-6">
          <button
            type="button"
            onClick={() => navigate("/plan")}
            className="inline-flex items-center gap-2 text-slate-900"
          >
            <SparkIcon className="h-4 w-4 text-sky-500" />
            <span className="text-base font-semibold">TripFlow</span>
          </button>

          {user ? (
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
            >
              <LogoutIcon className="h-3.5 w-3.5" />
              Logout
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
            >
              <LoginIcon className="h-3.5 w-3.5" />
              Login
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] p-3 md:p-5">
        {!plan && !loading ? (
          <section className="grid gap-4 lg:grid-cols-[430px_1fr]">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Plan your trip</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Fast planning with route-aware daily itinerary.
                </p>
              </div>

              <form onSubmit={handleSearch} className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Destination
                  </label>
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                    placeholder="Helsinki"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Days
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Month
                    </label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Companions
                    </label>
                    <select
                      value={companions}
                      onChange={(e) => setCompanions(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                    >
                      <option value="solo">Solo</option>
                      <option value="friends">Friends</option>
                      <option value="couple">Couple</option>
                      <option value="family">Family</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Transport
                    </label>
                    <select
                      value={transportation}
                      onChange={(e) => setTransportation(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                    >
                      <option value="public">Public / Walk</option>
                      <option value="car">Car</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Style</label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                  >
                    <option value="food">Food</option>
                    <option value="relax">Relax</option>
                    <option value="culture">Culture</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  <SparkIcon className="h-4 w-4" />
                  Generate plan
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <h2 className="text-sm font-semibold text-slate-900">My plans</h2>
              <div className="mt-3 grid gap-2">
                {userPlans.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                    No saved plans yet.
                  </p>
                ) : (
                  userPlans.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/plan/${item.id}`)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium text-slate-900">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.destination || "Unknown destination"} · {item.daysCount} days
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(item.id)}
                        className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-red-300 hover:text-red-600"
                        aria-label="Delete plan"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : null}

        {loading ? (
          <section className="mx-auto mt-6 max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900">
              <ProgressIcon className="h-4 w-4 animate-spin text-sky-500" />
              <h2 className="text-base font-semibold">Building your plan</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600">{loadingHints[loadingPhase]}</p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Travel tips while you wait
              </p>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {[0, 1, 2].map((offset) => {
                  const tip = travelTips[(loadingPhase + offset) % travelTips.length];
                  return (
                    <li key={`${loadingPhase}-${offset}`} className="rounded-lg bg-white px-3 py-2">
                      {tip}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ) : null}

        {plan && !loading ? (
          <section className="grid h-[calc(100vh-120px)] grid-rows-[auto_1fr] gap-3 md:h-[calc(100vh-110px)] lg:grid-cols-[420px_1fr] lg:grid-rows-1">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileView("itinerary")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    mobileView === "itinerary" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  <ListIcon className="h-3.5 w-3.5" />
                  Itinerary
                </button>
                <button
                  type="button"
                  onClick={() => setMobileView("map")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    mobileView === "map" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  Map
                </button>
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPlan(null);
                    setSelectedPlace(null);
                    navigate("/plan");
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                >
                  New
                </button>

                {planId ? (
                  <>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                    >
                      <ShareIcon className="h-3.5 w-3.5" />
                      Share
                    </button>
                    {isOwnedCurrentPlan ? (
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(planId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    ) : null}
                  </>
                ) : null}

                {!planId && user ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                  >
                    <SaveIcon className="h-3.5 w-3.5" />
                    {saving ? "Saving" : "Save"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[420px_1fr]">
              <div
                className={`${mobileView === "map" ? "hidden md:block" : "block"} min-h-0 border-r border-slate-200`}
              >
                <ItineraryList
                  plan={plan}
                  activeDayNumber={activeDayNumber}
                  onDaySelect={(dayNumber) => {
                    setActiveDayNumber(dayNumber);
                    setSelectedPlace(null);
                  }}
                  onPlaceClick={(dayNumber, placeName) => {
                    setActiveDayNumber(dayNumber);
                    setSelectedPlace(placeName);
                    setMobileView("map");
                  }}
                />
              </div>

              <div className={`${mobileView === "itinerary" ? "hidden md:block" : "block"} min-h-0`}>
                <MapContainer
                  plan={plan}
                  activeDayNumber={activeDayForMap}
                  selectedPlaceName={selectedPlace}
                  emptyKeyMessage="Google Maps API key is missing."
                />
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
};

export default PlanPage;

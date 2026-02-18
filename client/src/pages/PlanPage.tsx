import { useEffect, useState } from "react";
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
const optimizeRoute = (places: Place[]): Place[] => {
  if (places.length <= 2) return places.map((p, i) => ({ ...p, order: i }));
  const withLoc = places.filter((p) => p.location);
  const noLoc = places.filter((p) => !p.location);
  withLoc.sort((a, b) => b.location!.lat - a.location!.lat);
  return [...withLoc, ...noLoc].map((p, i) => ({ ...p, order: i }));
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
        };
      });
      day.places = optimizeRoute(enriched);
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
    // "2024-05-20" -> split("-")[1] -> "05" -> "5"
    const monthStr = parseInt(startDate.split("-")[1], 10).toString();

    try {
      const initialPlan = await generatePlan({
        destination,
        days: durationDays, // Calculated days
        companions,
        style,
        transportation,
        month: monthStr, // Calculated month
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

  const activeDayForMap =
    plan?.days.find((d) => d.dayNumber === activeDayNumber)?.dayNumber ?? 1;
  const isOwner = user && userPlans.some((p) => p.id === planId);

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="glass sticky top-0 z-50 shrink-0 px-4">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between">
          <div
            onClick={() => navigate("/plan")}
            className="flex cursor-pointer items-center gap-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
              <SparkIcon className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              TripFlow
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
                    className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3.5 text-lg font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Date Picker Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
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
                        // Reset end date if it becomes invalid
                        if (endDate && e.target.value > endDate) {
                          setEndDate("");
                        }
                      }}
                      className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      min={startDate || todayStr}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="public">Public / Walk</option>
                    <option value="car">Rental Car</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition active:scale-[0.98] disabled:opacity-70 hover:bg-indigo-700"
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
              <div className="absolute inset-0 animate-ping rounded-full bg-indigo-100"></div>
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-indigo-50 text-indigo-600 shadow-xl shadow-indigo-100">
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
          <div className="flex h-full w-full flex-col lg:flex-row">
            {/* Left: Itinerary List */}
            <div
              className={`
                ${mobileView === "map" ? "hidden" : "flex"} 
                flex-1 flex-col bg-white lg:flex lg:w-[450px] lg:max-w-[450px] lg:flex-none lg:border-r lg:border-slate-200 lg:shadow-xl z-10
              `}
            >
              <ItineraryList
                plan={plan!}
                activeDayNumber={activeDayNumber}
                onDaySelect={setActiveDayNumber}
                onPlaceClick={(d, name) => {
                  setActiveDayNumber(d);
                  setSelectedPlace(name);
                  setMobileView("map");
                }}
              />
            </div>

            {/* Right: Map */}
            <div
              className={`
                ${mobileView === "itinerary" ? "hidden lg:block" : "block"} 
                relative flex-1 bg-slate-100
              `}
            >
              <MapContainer
                plan={plan!}
                activeDayNumber={activeDayForMap}
                selectedPlaceName={selectedPlace}
                emptyKeyMessage="Map key missing"
              />

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
                    className="glass rounded-full p-3 text-rose-500 transition hover:scale-110 active:scale-90"
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
                  className="absolute right-4 bottom-28 lg:bottom-8 z-20 flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:scale-105 hover:bg-indigo-700 active:scale-95"
                >
                  <SaveIcon className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Plan"}
                </button>
              )}
            </div>

            {/* Mobile Bottom Toggle (Floating Glass Pill) */}
            <div className="absolute bottom-8 left-1/2 z-40 flex -translate-x-1/2 lg:hidden">
              <div className="glass flex items-center rounded-full p-1.5 ring-1 ring-slate-200/50">
                <button
                  onClick={() => setMobileView("itinerary")}
                  className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all ${
                    mobileView === "itinerary"
                      ? "bg-slate-900 text-white shadow-lg"
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
                      ? "bg-slate-900 text-white shadow-lg"
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

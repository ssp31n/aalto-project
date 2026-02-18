import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ItineraryList } from "../components/plan/ItineraryList";
import { GlobeIcon, ListIcon, LoginIcon, LogoutIcon, MapIcon, ProgressIcon, SaveIcon, ShareIcon, SparkIcon } from "../components/ui/icons";
import { useAuth } from "../contexts/AuthContext";
import { detectLocale, setLocale, t, type Locale } from "../i18n";
import { generatePlan, getPlaceDetailsBatch } from "../services/api";
import { getPlan, savePlan } from "../services/planService";
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

const optimizeRoute = (places: Place[]): Place[] => {
  if (places.length <= 2) {
    return places.map((place, index) => ({ ...place, order: index }));
  }

  const withLocation = places.filter((place) => place.location);
  const withoutLocation = places.filter((place) => !place.location);

  if (!withLocation.length) {
    return places.map((place, index) => ({ ...place, order: index }));
  }

  const mealPlaces = withLocation.filter((place) => place.activityType === "meal");
  const nonMealPlaces = withLocation.filter((place) => place.activityType !== "meal");

  const ordered: Place[] = [];
  const remaining = [...nonMealPlaces];

  if (remaining.length) {
    ordered.push(remaining.shift()!);
  }

  while (remaining.length) {
    const current = ordered[ordered.length - 1];
    let nextIndex = 0;
    let min = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const target = remaining[i];
      const distance = getDistance(
        current.location!.lat,
        current.location!.lng,
        target.location!.lat,
        target.location!.lng,
      );
      if (distance < min) {
        min = distance;
        nextIndex = i;
      }
    }

    ordered.push(remaining[nextIndex]);
    remaining.splice(nextIndex, 1);
  }

  if (mealPlaces.length > 0) {
    const insertIndexes = [Math.floor(ordered.length * 0.35), Math.floor(ordered.length * 0.75)];
    mealPlaces.forEach((meal, idx) => {
      const insertAt = Math.min(insertIndexes[idx] ?? ordered.length - 1, ordered.length);
      ordered.splice(Math.max(1, insertAt), 0, meal);
    });
  }

  return [...ordered, ...withoutLocation].map((place, index) => ({
    ...place,
    order: index,
  }));
};

const PlanPage = () => {
  const { user, logout } = useAuth();
  const { planId } = useParams();
  const navigate = useNavigate();

  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());
  const [mobileView, setMobileView] = useState<"itinerary" | "map">("itinerary");

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(1);
  const [companions, setCompanions] = useState("friends");
  const [style, setStyle] = useState("food");
  const [transportation, setTransportation] = useState("public");
  const [month, setMonth] = useState("5");

  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(5);
  const [loadingPhase, setLoadingPhase] = useState(0);

  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [activeDayNumber, setActiveDayNumber] = useState(1);

  const loadingHints = useMemo(
    () => [t(locale, "loadingHint1"), t(locale, "loadingHint2"), t(locale, "loadingHint3")],
    [locale],
  );

  useEffect(() => {
    if (!loading) return;

    setLoadingProgress(8);
    setLoadingPhase(0);

    const progressTimer = setInterval(() => {
      setLoadingProgress((prev) => (prev >= 92 ? prev : prev + Math.random() * 11));
    }, 700);

    const phaseTimer = setInterval(() => {
      setLoadingPhase((prev) => (prev + 1) % 3);
    }, 1600);

    return () => {
      clearInterval(progressTimer);
      clearInterval(phaseTimer);
    };
  }, [loading]);

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
            ? { lat: details.location.latitude, lng: details.location.longitude }
            : place.location,
          photoUrl: details.photoUrl || place.photoUrl,
          rating: details.rating,
          userRatingCount: details.userRatingCount,
          googlePlaceId: details.googlePlaceId,
          address: details.address,
          businessStatus: details.businessStatus,
          openNow: typeof details.openNow === "boolean" ? details.openNow : undefined,
        };
      });

      day.places = optimizeRoute(enriched);
    }

    return nextPlan;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      alert(t(locale, "chooseDestination"));
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
      setLoadingProgress(100);
    } catch (error) {
      console.error(error);
      alert(t(locale, "createFail"));
    } finally {
      setTimeout(() => setLoading(false), 250);
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
        alert(t(locale, "loadFail"));
        navigate("/plan");
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [planId, navigate, locale]);

  const changeLocale = (next: Locale) => {
    setLocale(next);
    setLocaleState(next);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert(t(locale, "shareSuccess"));
    } catch (error) {
      console.error(error);
    }
  };

  const handleSave = async () => {
    if (!plan || !user) return;

    setSaving(true);
    try {
      const id = await savePlan({ ...plan, destination }, user.uid);
      alert(t(locale, "saveSuccess"));
      navigate(`/plan/${id}`);
    } catch (error) {
      console.error(error);
      alert(t(locale, "saveFail"));
    } finally {
      setSaving(false);
    }
  };

  const activeDayForMap = plan?.days.find((d) => d.dayNumber === activeDayNumber)
    ? activeDayNumber
    : (plan?.days[0]?.dayNumber ?? 1);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f0f9ff_0%,_#f8fafc_45%,_#eef2ff_100%)]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-6">
          <button
            type="button"
            onClick={() => navigate("/plan")}
            className="inline-flex items-center gap-2 text-slate-900"
          >
            <SparkIcon className="h-5 w-5 text-sky-500" />
            <span className="text-lg font-semibold">{t(locale, "brand")}</span>
          </button>

          <div className="flex items-center gap-2 md:gap-3">
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
              <GlobeIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t(locale, "language")}</span>
              <select
                value={locale}
                onChange={(e) => changeLocale(e.target.value as Locale)}
                className="bg-transparent text-xs text-slate-700 outline-none"
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="fi">Suomi</option>
              </select>
            </label>

            {user ? (
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300"
              >
                <LogoutIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t(locale, "logout")}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300"
              >
                <LoginIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t(locale, "login")}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] p-4 md:p-6">
        {!plan && !loading ? (
          <section className="grid gap-6 lg:grid-cols-[430px_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h1 className="text-2xl font-semibold text-slate-900">{t(locale, "startTrip")}</h1>
              <p className="mt-2 text-sm text-slate-600">{t(locale, "subtitle")}</p>

              <form onSubmit={handleSearch} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t(locale, "destination")}</label>
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                    placeholder="Helsinki"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">{t(locale, "days")}</label>
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
                    <label className="mb-1 block text-sm font-medium text-slate-700">{t(locale, "month")}</label>
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">{t(locale, "companions")}</label>
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
                    <label className="mb-1 block text-sm font-medium text-slate-700">{t(locale, "transport")}</label>
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t(locale, "style")}</label>
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  <SparkIcon className="h-4 w-4" />
                  {t(locale, "generate")}
                </button>
              </form>
            </div>

            <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:block">
              <MapContainer
                plan={null}
                activeDayNumber={1}
                selectedPlaceName={null}
                emptyKeyMessage={t(locale, "loadingMapKey")}
              />
            </div>
          </section>
        ) : null}

        {loading ? (
          <section className="mx-auto mt-8 max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-slate-900">
              <ProgressIcon className="h-5 w-5 animate-spin text-sky-500" />
              <h2 className="text-lg font-semibold">{t(locale, "loadingTitle")}</h2>
            </div>
            <p className="mt-4 text-sm text-slate-600">{loadingHints[loadingPhase]}</p>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round(loadingProgress))}%` }}
              />
            </div>
            <p className="mt-2 text-right text-xs text-slate-500">{Math.round(loadingProgress)}%</p>
          </section>
        ) : null}

        {plan && !loading ? (
          <section className="grid h-[calc(100vh-140px)] grid-rows-[auto_1fr] gap-3 md:h-[calc(100vh-130px)] md:gap-4 lg:grid-cols-[420px_1fr] lg:grid-rows-1">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileView("itinerary")}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    mobileView === "itinerary" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  <ListIcon className="h-3.5 w-3.5" />
                  {t(locale, "viewItinerary")}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileView("map")}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    mobileView === "map" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  {t(locale, "viewMap")}
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlan(null);
                    setSelectedPlace(null);
                    navigate("/plan");
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                >
                  {t(locale, "newPlan")}
                </button>

                {planId ? (
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                  >
                    <ShareIcon className="h-3.5 w-3.5" />
                    {t(locale, "share")}
                  </button>
                ) : null}

                {!planId && user ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                  >
                    <SaveIcon className="h-3.5 w-3.5" />
                    {saving ? "..." : t(locale, "save")}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[420px_1fr]">
              <div className={`${mobileView === "map" ? "hidden md:block" : "block"} min-h-0 border-r border-slate-200`}>
                <ItineraryList
                  plan={plan}
                  localeDayLabel={t(locale, "day")}
                  activityLabelMap={{
                    meal: t(locale, "activityMeal"),
                    sightseeing: t(locale, "activitySightseeing"),
                    activity: t(locale, "activityExperience"),
                  }}
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
                  emptyKeyMessage={t(locale, "loadingMapKey")}
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

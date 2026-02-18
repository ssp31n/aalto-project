export type Locale = "ko" | "en" | "fi";

type MessageKey =
  | "brand"
  | "subtitle"
  | "login"
  | "logout"
  | "destination"
  | "days"
  | "month"
  | "companions"
  | "transport"
  | "style"
  | "generate"
  | "newPlan"
  | "share"
  | "save"
  | "saved"
  | "day"
  | "tripSummary"
  | "loadingTitle"
  | "loadingHint1"
  | "loadingHint2"
  | "loadingHint3"
  | "continueWithGoogle"
  | "language"
  | "viewItinerary"
  | "viewMap"
  | "chooseDestination"
  | "loadFail"
  | "createFail"
  | "saveFail"
  | "saveSuccess"
  | "shareSuccess"
  | "loadingMapKey"
  | "startTrip"
  | "activityMeal"
  | "activitySightseeing"
  | "activityExperience";

const messages: Record<Locale, Record<MessageKey, string>> = {
  ko: {
    brand: "TripFlow",
    subtitle: "당신의 여행 동선을 빠르게 설계합니다",
    login: "로그인",
    logout: "로그아웃",
    destination: "여행지",
    days: "기간 (일)",
    month: "여행 시기",
    companions: "동행",
    transport: "이동 수단",
    style: "여행 스타일",
    generate: "계획 생성",
    newPlan: "새 계획",
    share: "공유",
    save: "저장",
    saved: "저장됨",
    day: "Day",
    tripSummary: "일정",
    loadingTitle: "계획을 생성하고 있어요",
    loadingHint1: "일자별 추천 장소를 정리 중",
    loadingHint2: "장소 좌표와 운영 정보를 검증 중",
    loadingHint3: "동선을 최적화하는 중",
    continueWithGoogle: "Google로 계속하기",
    language: "언어",
    viewItinerary: "일정",
    viewMap: "지도",
    chooseDestination: "여행지를 입력해주세요.",
    loadFail: "여행 계획을 불러올 수 없습니다.",
    createFail: "여행 계획 생성 중 오류가 발생했습니다.",
    saveFail: "저장에 실패했습니다.",
    saveSuccess: "여행 계획이 저장되었습니다.",
    shareSuccess: "공유 링크가 복사되었습니다.",
    loadingMapKey: "Google Maps API 키가 설정되지 않았습니다.",
    startTrip: "여행을 시작해보세요",
    activityMeal: "식사",
    activitySightseeing: "관광",
    activityExperience: "체험",
  },
  en: {
    brand: "TripFlow",
    subtitle: "Plan smarter routes for your next trip",
    login: "Log in",
    logout: "Log out",
    destination: "Destination",
    days: "Duration (days)",
    month: "Travel month",
    companions: "Companions",
    transport: "Transportation",
    style: "Travel style",
    generate: "Generate plan",
    newPlan: "New plan",
    share: "Share",
    save: "Save",
    saved: "Saved",
    day: "Day",
    tripSummary: "Itinerary",
    loadingTitle: "Building your trip plan",
    loadingHint1: "Structuring daily recommendations",
    loadingHint2: "Validating places and coordinates",
    loadingHint3: "Optimizing your route",
    continueWithGoogle: "Continue with Google",
    language: "Language",
    viewItinerary: "Itinerary",
    viewMap: "Map",
    chooseDestination: "Please enter a destination.",
    loadFail: "Unable to load the plan.",
    createFail: "Failed to generate plan.",
    saveFail: "Failed to save plan.",
    saveSuccess: "Plan saved successfully.",
    shareSuccess: "Share link copied.",
    loadingMapKey: "Google Maps API key is missing.",
    startTrip: "Start your trip planning",
    activityMeal: "Meal",
    activitySightseeing: "Sightseeing",
    activityExperience: "Experience",
  },
  fi: {
    brand: "TripFlow",
    subtitle: "Suunnittele matkareitti sujuvasti",
    login: "Kirjaudu",
    logout: "Kirjaudu ulos",
    destination: "Kohde",
    days: "Kesto (päivää)",
    month: "Matkakuukausi",
    companions: "Seurue",
    transport: "Liikkumistapa",
    style: "Matkatyyli",
    generate: "Luo suunnitelma",
    newPlan: "Uusi suunnitelma",
    share: "Jaa",
    save: "Tallenna",
    saved: "Tallennettu",
    day: "Päivä",
    tripSummary: "Matkaohjelma",
    loadingTitle: "Luodaan matkasuunnitelmaa",
    loadingHint1: "Järjestetään päivän kohteita",
    loadingHint2: "Tarkistetaan kohteet ja sijainnit",
    loadingHint3: "Optimoidaan reittiä",
    continueWithGoogle: "Jatka Google-tilillä",
    language: "Kieli",
    viewItinerary: "Ohjelma",
    viewMap: "Kartta",
    chooseDestination: "Anna matkakohde.",
    loadFail: "Suunnitelmaa ei voitu ladata.",
    createFail: "Suunnitelman luonti epäonnistui.",
    saveFail: "Tallennus epäonnistui.",
    saveSuccess: "Suunnitelma tallennettu.",
    shareSuccess: "Jakolinkki kopioitu.",
    loadingMapKey: "Google Maps API-avain puuttuu.",
    startTrip: "Aloita matkan suunnittelu",
    activityMeal: "Ruokailu",
    activitySightseeing: "Nähtävyys",
    activityExperience: "Tekeminen",
  },
};

export const detectLocale = (): Locale => {
  const stored = localStorage.getItem("tripflow_locale");
  if (stored === "ko" || stored === "en" || stored === "fi") return stored;
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("ko")) return "ko";
  if (lang.startsWith("fi")) return "fi";
  return "en";
};

export const setLocale = (locale: Locale) => {
  localStorage.setItem("tripflow_locale", locale);
};

export const t = (locale: Locale, key: MessageKey): string => messages[locale][key];

import os
import json
import re
import requests
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from google import genai
from google.genai import types

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID")
LOCATION = os.getenv("GCP_LOCATION", "asia-northeast3")
MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

client = None
try:
    client = genai.Client(
        vertexai=True,
        project=PROJECT_ID,
        location=LOCATION
    )
    print("Google Gen AI Client initialized (Vertex AI mode)")
except Exception as e:
    print(f"Client init failed: {e}")

app = FastAPI()
cors_origins_env = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173")
allow_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
allow_credentials = "*" not in allow_origins

# 1. React 빌드 결과물 경로 설정 (Dockerfile 구조 기준)
# 나중에 Dockerfile에서 client/dist 폴더를 server/static으로 복사할 예정입니다.
build_dir = os.path.join(os.path.dirname(__file__), "static")

# 빌드 폴더가 존재할 때만 실행 (로컬 개발 시 에러 방지)
if os.path.isdir(build_dir):
    # assets 폴더 (CSS, JS, 이미지 등) 서빙
    app.mount("/assets", StaticFiles(directory=os.path.join(build_dir, "assets")), name="assets")

    # 2. SPA 라우팅 처리 (새로고침 시 404 방지 -> index.html 반환)
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # API 요청이 아닌 경우 index.html 반환
        if full_path.startswith("api"):
            return {"error": "Not Found"}
            
        file_path = os.path.join(build_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        return FileResponse(os.path.join(build_dir, "index.html"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

PLACE_CACHE_TTL_SEC = 60 * 60 * 6
destination_center_cache: dict[str, tuple[float, dict]] = {}
place_details_cache: dict[str, tuple[float, dict]] = {}

class PlanRequest(BaseModel):
    destination: str
    days: int
    companions: str
    style: str
    transportation: str
    month: str
    useWebSearch: bool = False

class PlaceDetailsBatchRequest(BaseModel):
    placeNames: list[str]
    destination: str | None = None

@app.get("/")
def read_root():
    return {"message": "triplo API is running"}

def _extract_json_object(text: str):
    text = (text or "").strip()
    if not text:
        raise ValueError("Empty response from model")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if match:
        block = match.group(1).strip()
        try:
            return json.loads(block)
        except json.JSONDecodeError:
            pass

    obj_match = re.search(r"\{.*\}", text, re.DOTALL)
    if obj_match:
        return json.loads(obj_match.group(0))

    raise ValueError("No parseable JSON object found in model response")


def _normalize_activity_type(value: str) -> str:
    lowered = (value or "").strip().lower()
    if lowered in {"meal", "sightseeing", "activity"}:
        return lowered
    if any(k in lowered for k in ["식당", "맛집", "meal", "restaurant", "cafe", "카페"]):
        return "meal"
    if any(k in lowered for k in ["체험", "activity", "액티비티"]):
        return "activity"
    return "sightseeing"


_REPEATABLE_HUB_KEYWORDS = [
    "station",
    "railway",
    "bus terminal",
    "terminal",
    "port",
    "harbor",
    "harbour",
    "pier",
    "ferry",
    "airport",
    "metro",
    "subway",
    "downtown",
    "city center",
    "city centre",
    "central",
    "main square",
    "shopping district",
    "market hall",
    "mall",
    "plaza",
]


def _normalize_place_key(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9\s]", " ", (name or "").lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _is_repeatable_hub(place_name: str, description: str) -> bool:
    text = f"{place_name} {description}".lower()
    return any(keyword in text for keyword in _REPEATABLE_HUB_KEYWORDS)


def _extract_area_hint(place_name: str, description: str) -> str | None:
    text = f"{place_name} {description}".lower()
    patterns = [
        r"\b([a-z0-9'\- ]{2,40})\s+(district|neighborhood|neighbourhood|quarter|area)\b",
        r"\b(old town|city center|city centre|downtown|waterfront)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue
        hint = match.group(1).strip() if match.lastindex and match.lastindex >= 1 else match.group(0).strip()
        hint = re.sub(r"\s+", " ", hint)
        if hint:
            return hint
    return None


def _de_duplicate_non_hub_places(days: list[dict]) -> list[dict]:
    seen_non_hub: set[str] = set()
    for day in days:
        places = day.get("places", [])
        if not places:
            continue

        deduped = []
        for place in places:
            place_name = place.get("placeName", "")
            description = place.get("description", "")
            key = _normalize_place_key(place_name)
            if not key:
                deduped.append(place)
                continue

            if _is_repeatable_hub(place_name, description):
                deduped.append(place)
                continue

            if key in seen_non_hub and len(places) > 4:
                continue

            seen_non_hub.add(key)
            deduped.append(place)

        for idx, place in enumerate(deduped):
            place["order"] = idx
        day["places"] = deduped
    return days


def _reorder_days_for_area_variety(days: list[dict]) -> list[dict]:
    if len(days) < 4:
        return days

    def dominant_area(day: dict) -> str | None:
        scores: dict[str, int] = {}
        for place in day.get("places", []):
            hint = _extract_area_hint(place.get("placeName", ""), place.get("description", ""))
            if not hint:
                continue
            scores[hint] = scores.get(hint, 0) + 1
        if not scores:
            return None
        return max(scores.items(), key=lambda x: x[1])[0]

    remaining = [{"day": day, "area": dominant_area(day)} for day in days]
    unique_areas = {entry["area"] for entry in remaining if entry["area"]}
    if len(unique_areas) < 2:
        return days

    ordered = [remaining.pop(0)]
    while remaining:
        prev_area = ordered[-1]["area"]
        different_area_idx = next(
            (i for i, entry in enumerate(remaining) if entry["area"] and entry["area"] != prev_area),
            None
        )
        pick_idx = different_area_idx if different_area_idx is not None else 0
        ordered.append(remaining.pop(pick_idx))

    result = [entry["day"] for entry in ordered]
    for idx, day in enumerate(result, start=1):
        day["dayNumber"] = idx
    return result


def _normalize_plan_schema(plan_data: dict, requested_days: int, destination: str, style: str):
    raw_days = plan_data.get("days", [])
    normalized_days = []

    for day_index, raw_day in enumerate(raw_days, start=1):
        places = raw_day.get("places", [])
        normalized_places = []

        for place_index, raw_place in enumerate(places):
            try:
                duration_min = int(raw_place.get("durationMin", 90))
            except (TypeError, ValueError):
                duration_min = 90

            activity_type = _normalize_activity_type(
                raw_place.get("activityType") or raw_place.get("theme") or ""
            )
            text = f"{raw_place.get('placeName', '')} {raw_place.get('description', '')}".lower()
            if any(k in text for k in ["hotel", "hostel", "accommodation", "숙소", "flight", "airport", "항공"]):
                continue

            normalized_places.append({
                "order": place_index,
                "placeName": raw_place.get("placeName", "").strip(),
                "description": raw_place.get("description", "").strip(),
                "activityType": activity_type,
                "durationMin": duration_min if duration_min > 0 else 90
            })

        normalized_days.append({
            "dayNumber": int(raw_day.get("dayNumber", raw_day.get("day", day_index))),
            "places": normalized_places
        })

    if requested_days > 0:
        normalized_days = normalized_days[:requested_days]
        while len(normalized_days) < requested_days:
            normalized_days.append({
                "dayNumber": len(normalized_days) + 1,
                "places": []
            })

    for idx, day in enumerate(normalized_days, start=1):
        day["dayNumber"] = idx

    normalized_days = _de_duplicate_non_hub_places(normalized_days)
    normalized_days = _reorder_days_for_area_variety(normalized_days)

    title = plan_data.get("title") or f"{destination} {style} 여행"
    return {"title": title, "days": normalized_days}

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import radians, sin, cos, sqrt, atan2

    r = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c

def _search_text(payload: dict, headers: dict):
    url = "https://places.googleapis.com/v1/places:searchText"
    response = requests.post(url, json=payload, headers=headers, timeout=15)
    response.raise_for_status()
    data = response.json()
    return data.get("places", [])

def _build_places_headers():
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAPS_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.photos,places.location,places.businessStatus,places.types,places.primaryType,places.primaryTypeDisplayName,places.editorialSummary"
    }

def _get_cache(cache: dict, key: str):
    hit = cache.get(key)
    if not hit:
        return None
    cached_at, value = hit
    if time.time() - cached_at > PLACE_CACHE_TTL_SEC:
        del cache[key]
        return None
    return value

def _set_cache(cache: dict, key: str, value: dict):
    cache[key] = (time.time(), value)

def _resolve_destination_center(destination: str, headers: dict):
    normalized_destination = destination.strip().lower()
    if not normalized_destination:
        return None

    cached = _get_cache(destination_center_cache, normalized_destination)
    if cached:
        return cached

    destination_candidates = _search_text({"textQuery": destination}, headers)
    if not destination_candidates:
        return None

    loc = destination_candidates[0].get("location")
    if not loc:
        return None

    center = {
        "latitude": loc.get("latitude"),
        "longitude": loc.get("longitude"),
    }
    _set_cache(destination_center_cache, normalized_destination, center)
    return center

def _to_place_response(place: dict):
    photo_url = None
    if "photos" in place and len(place["photos"]) > 0:
        photo_ref = place["photos"][0]["name"]
        photo_url = f"https://places.googleapis.com/v1/{photo_ref}/media?maxHeightPx=400&maxWidthPx=400&key={MAPS_API_KEY}"

    def _hashtags_from_place(meta: dict) -> list[str]:
        text = " ".join([
            ((meta.get("displayName") or {}).get("text") or ""),
            (meta.get("formattedAddress") or ""),
            ((meta.get("editorialSummary") or {}).get("text") or ""),
            " ".join(meta.get("types") or []),
            str(meta.get("primaryType") or ""),
            str(((meta.get("primaryTypeDisplayName") or {}).get("text") or "")),
        ]).lower()

        tag_rules = [
            ("#ScenicSpot", ["viewpoint", "observation", "waterfront", "sunset", "panorama", "scenic"]),
            ("#LocalFavorite", ["local", "popular", "authentic", "hidden"]),
            ("#PhotoSpot", ["photo", "instagram", "iconic", "landmark"]),
            ("#CozyCafe", ["cafe", "coffee", "bakery", "dessert"]),
            ("#VibeRestaurant", ["restaurant", "bistro", "dining", "brasserie", "izakaya", "bbq"]),
            ("#StreetFood", ["street_food", "food_court", "market"]),
            ("#CultureTrip", ["museum", "gallery", "historic", "church", "cathedral", "monument"]),
            ("#NatureWalk", ["park", "garden", "forest", "beach", "lake"]),
            ("#ShoppingTime", ["shopping", "mall", "market", "plaza"]),
            ("#NightOut", ["bar", "pub", "club", "night"]),
        ]

        tags = []
        for tag, keywords in tag_rules:
            if any(keyword in text for keyword in keywords):
                tags.append(tag)
            if len(tags) >= 3:
                break

        if not tags:
            tags = ["#MustVisit"]
        return tags[:3]

    return {
        "found": True,
        "canonicalName": (place.get("displayName") or {}).get("text"),
        "address": place.get("formattedAddress", ""),
        "rating": place.get("rating", 0),
        "userRatingCount": place.get("userRatingCount", 0),
        "googlePlaceId": place.get("id"),
        "location": place.get("location", {"latitude": 0, "longitude": 0}),
        "photoUrl": photo_url,
        "hashtags": _hashtags_from_place(place),
    }

def _resolve_place_details(place_name: str, destination: str, headers: dict, destination_center: dict | None):
    cache_key = f"{place_name.strip().lower()}::{destination.strip().lower()}"
    cached = _get_cache(place_details_cache, cache_key)
    if cached:
        return cached

    payload = {"textQuery": place_name}
    if destination_center:
        payload["locationBias"] = {
            "circle": {
                "center": destination_center,
                "radius": 50000.0
            }
        }

    candidates = _search_text(payload, headers)
    if not candidates and destination:
        candidates = _search_text(
            {"textQuery": f"{place_name}, {destination}"},
            headers
        )

    if not candidates:
        result = {"found": False}
        _set_cache(place_details_cache, cache_key, result)
        return result

    normalized_destination = destination.lower()
    ranked = []
    for place in candidates:
        score = 0
        address = place.get("formattedAddress", "").lower()
        if normalized_destination and normalized_destination in address:
            score += 10

        if destination_center and place.get("location"):
            distance = _haversine_km(
                destination_center["latitude"],
                destination_center["longitude"],
                place["location"]["latitude"],
                place["location"]["longitude"],
            )
            if distance <= 60:
                score += 8
            elif distance <= 120:
                score += 3
            else:
                score -= 10

        if place.get("businessStatus") == "OPERATIONAL":
            score += 3

        ranked.append((score, place))

    ranked.sort(key=lambda x: x[0], reverse=True)
    best_score, best_place = ranked[0]
    if best_score < 0:
        result = {"found": False}
        _set_cache(place_details_cache, cache_key, result)
        return result

    result = _to_place_response(best_place)
    _set_cache(place_details_cache, cache_key, result)
    return result


@app.post("/api/plans/generate")
@app.post("/api/generate-plan")
async def generate_plan(request: PlanRequest):
    print(f"[Request] {request.destination}, {request.month}, {request.transportation}")

    if not client:
        raise HTTPException(status_code=500, detail="Gen AI Client not initialized")

    try:
        use_web_search = request.useWebSearch
        tool_instruction = (
            "Use Google Search tool to verify real-world availability and recency before suggesting places."
            if use_web_search
            else "Do not browse the web. Generate a practical and coherent plan quickly."
        )

        prompt = f"""
        Current date is February 18, 2026.
        {tool_instruction}

        Trip context:
        - Destination: {request.destination}
        - Month: {request.month} (year 2026)
        - Duration: {request.days} days
        - Companions: {request.companions}
        - Transportation: {request.transportation}
        - Style: {request.style}

        Rules:
        1) Exclude permanently closed places.
        2) Optimize each day's route for nearby spots and realistic movement.
        3) Return ONLY a valid JSON object. No markdown, no commentary.
        4) Use exact official place names (disambiguated), e.g., "Helsinki Central Railway Station" not "Central Station".
        5) Keep each day dense and practical:
           - 6 to 8 places per day
           - total activity duration per day: 480 to 660 minutes
           - avoid long idle gaps
        6) Ensure temporal flow is natural:
           - morning: sightseeing/activity/cafe
           - midday: lunch
           - afternoon: sightseeing/activity
           - evening: dinner/night activity
           - avoid consecutive transport-hub stops (e.g., multiple terminals/pier/stations in a row) unless essential
           - do not place meal spots back-to-back
           - for ordinary restaurants/cafes, prioritize options close to the main movement corridor of the day
           - allow detours only for clearly high-value dining spots (iconic/signature/famous)
        7) Exclude accommodation and flights completely from the itinerary.
        8) Avoid duplicate non-hub places across days:
           - if a restaurant/attraction was already used in a previous day, do not repeat it
           - exception: transport hubs and repeatable anchor spots are allowed (railway/bus terminals, ferry ports, city center, major shopping district)
        9) For longer trips (4+ days), diversify by area:
           - split the destination into multiple neighborhoods/districts
           - each day should center on a different area as much as possible
           - avoid itineraries where all days repeatedly stay in the same area
        10) Follow this schema exactly:
        {{
          "title": "string",
          "days": [
            {{
              "dayNumber": 1,
              "places": [
                {{
                  "placeName": "Official place name searchable on Google Maps",
                  "activityType": "meal|sightseeing|activity",
                  "description": "Why this matches the trip style",
                  "durationMin": 90
                }}
              ]
            }}
          ]
        }}

        Ensure the itinerary has exactly {request.days} day entries.
        """

        config = types.GenerateContentConfig(temperature=0.4)
        if use_web_search:
            config = types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.4
            )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=config
        )

        plan_data = _extract_json_object(response.text or "")
        normalized_plan = _normalize_plan_schema(
            plan_data=plan_data,
            requested_days=request.days,
            destination=request.destination,
            style=request.style
        )
        return normalized_plan

    except Exception as e:
        print(f"Error during generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/get-place-details-batch")
async def get_place_details_batch(request: PlaceDetailsBatchRequest):
    if not MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="API Key missing")

    try:
        headers = _build_places_headers()
        destination = (request.destination or "").strip()
        destination_center = _resolve_destination_center(destination, headers) if destination else None
        unique_names = list(dict.fromkeys([name.strip() for name in request.placeNames if name.strip()]))

        results = {}
        for place_name in unique_names:
            results[place_name] = _resolve_place_details(
                place_name=place_name,
                destination=destination,
                headers=headers,
                destination_center=destination_center
            )

        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

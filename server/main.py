# server/main.py
import os
import json
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import vertexai
from vertexai.generative_models import GenerativeModel

# 1. .env 파일에서 환경 변수 불러오기
load_dotenv()

# 2. Google Cloud 및 Vertex AI 설정
PROJECT_ID = os.getenv("GCP_PROJECT_ID")
LOCATION = os.getenv("GCP_LOCATION", "asia-northeast3") 
CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# Vertex AI 초기화
try:
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    model = GenerativeModel("gemini-2.5-flash")
    print(f"✅ Vertex AI Initialized (Region: {LOCATION})")
except Exception as e:
    print(f"❌ Vertex AI Init Failed: {e}")

# 3. FastAPI 앱 생성
app = FastAPI()

# 4. CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. 요청 데이터 검증 모델
class PlanRequest(BaseModel):
    destination: str
    days: int
    companions: str
    style: str

class PlaceDetailRequest(BaseModel):
    placeName: str

@app.get("/")
def read_root():
    return {"message": "TripFlow API is running with FastAPI 🚀"}

# 6. 여행 계획 생성 API (핵심 프롬프트 수정됨)
@app.post("/api/generate-plan")
async def generate_plan(request: PlanRequest):
    print(f"[Request] 여행지: {request.destination}, 기간: {request.days}일")

    try:
        # [핵심 수정] AI에게 구체적인 장소명을 요구하는 프롬프트
        prompt = f"""
        당신은 전문 여행 플래너입니다. 아래 정보를 바탕으로 여행 계획을 짜주세요.
        
        [여행 정보]
        - 여행지: {request.destination}
        - 기간: {request.days}일
        - 동행: {request.companions}
        - 스타일: {request.style}

        [필수 규칙]
        1. `placeName` 필드에는 '점심 식사', '호텔 체크인', '기념품 쇼핑', '자유 시간' 같은 추상적인 활동명을 절대 적지 마세요.
        2. 반드시 Google Maps에서 검색 가능한 **실제 장소의 구체적인 고유 명사**(예: '스토크만 백화점', '카페 레가타', '디자인 박물관', '식당 이름')를 적어야 합니다.
        3. 활동에 대한 설명(예: 기념품 사기, 커피 마시기)은 `description` 필드에 적으세요.
        4. 동선은 효율적으로 짜주세요.

        반드시 아래 JSON 형식으로만 응답해주세요. 마크다운(\`\`\`)이나 서론/결론 같은 추가 텍스트는 넣지 마세요. 순수 JSON만 반환하세요.
        {{
            "title": "여행 제목 (예: 핀란드 힐링 여행)",
            "days": [
                {{
                    "day": 1,
                    "places": [
                        {{
                            "placeName": "장소명 (실제 검색 가능한 고유명사 필수)",
                            "description": "구체적인 활동 내용 및 추천 이유",
                            "theme": "식사" 
                        }}
                    ]
                }}
            ]
        }}
        """

        response = model.generate_content(prompt)
        text = response.text
        print("[AI Response]", text)

        # 응답 데이터 전처리
        clean_text = text.replace("```json", "").replace("```", "").strip()
        
        plan_data = json.loads(clean_text)
        return plan_data

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 7. 장소 정보 조회 API
@app.post("/api/get-place-details")
async def get_place_details(request: PlaceDetailRequest):
    if not MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Server Maps API Key not configured")

    url = "https://places.googleapis.com/v1/places:searchText"
    
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAPS_API_KEY,
        "X-Goog-FieldMask": "places.id,places.formattedAddress,places.rating,places.photos,places.location" 
    }
    
    # Client에서 이미 "장소명 + 여행지" 형태로 조합해서 보내주므로 그대로 사용
    payload = {
        "textQuery": request.placeName
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        if "places" in data and len(data["places"]) > 0:
            place = data["places"][0]
            
            photo_url = None
            if "photos" in place and len(place["photos"]) > 0:
                photo_ref = place["photos"][0]["name"]
                # 이미지 크기 파라미터 수정 (maxHeightPx, maxWidthPx)
                photo_url = f"https://places.googleapis.com/v1/{photo_ref}/media?maxHeightPx=400&maxWidthPx=400&key={MAPS_API_KEY}"

            return {
                "found": True,
                "address": place.get("formattedAddress", ""),
                "rating": place.get("rating", 0),
                "location": place.get("location", {"latitude": 0, "longitude": 0}),
                "photoUrl": photo_url
            }
        else:
            return {"found": False}

    except Exception as e:
        print(f"Places API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
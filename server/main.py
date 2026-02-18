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
# .env에 있는 값을 가져오되, 없으면 기본값 사용
PROJECT_ID = os.getenv("GCP_PROJECT_ID")
LOCATION = os.getenv("GCP_LOCATION", "asia-northeast3") 
CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY") # API 키 로드

# Vertex AI 초기화 (에러 처리 포함)
try:
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    # Gemini Pro 모델 로드
    model = GenerativeModel("gemini-2.5-flash")
    print(f"✅ Vertex AI Initialized (Region: {LOCATION})")
except Exception as e:
    print(f"❌ Vertex AI Init Failed: {e}")

# 3. FastAPI 앱 생성
app = FastAPI()

# 4. CORS 설정 (프론트엔드와 통신 허용)
# 리액트 개발 서버 주소(http://localhost:5173)에서의 요청을 허용합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. 요청 데이터 검증을 위한 모델 정의
class PlanRequest(BaseModel):
    destination: str
    days: int
    companions: str
    style: str

class PlaceDetailRequest(BaseModel):
    placeName: str

# 기본 접속 테스트용
@app.get("/")
def read_root():
    return {"message": "TripFlow API is running with FastAPI 🚀"}

# 6. 여행 계획 생성 API (핵심 로직)
@app.post("/api/generate-plan")
async def generate_plan(request: PlanRequest):
    print(f"[Request] 여행지: {request.destination}, 기간: {request.days}일")

    try:
        # AI에게 보낼 질문(Prompt) 구성
        prompt = f"""
        당신은 전문 여행 플래너입니다. 아래 정보를 바탕으로 여행 계획을 짜주세요.
        - 여행지: {request.destination}
        - 기간: {request.days}일
        - 동행: {request.companions}
        - 스타일: {request.style}

        반드시 아래 JSON 형식으로만 응답해주세요. 마크다운(\`\`\`)이나 추가 설명은 넣지 마세요.
        {{
            "title": "여행 제목",
            "days": [
                {{
                    "day": 1,
                    "places": [
                        {{
                            "placeName": "장소명",
                            "description": "한 줄 추천 이유",
                            "theme": "식사"
                        }}
                    ]
                }}
            ]
        }}
        """

        # AI에게 질문 전송 및 응답 대기
        response = model.generate_content(prompt)
        text = response.text
        print("[AI Response]", text)

        # 응답 데이터 전처리 (마크다운 기호 제거)
        clean_text = text.replace("```json", "").replace("```", "").strip()
        
        # 문자열을 JSON 객체로 변환
        plan_data = json.loads(clean_text)
        
        return plan_data

    except Exception as e:
        print(f"Error: {e}")
        # 에러 발생 시 500 상태코드와 에러 메시지 반환
        raise HTTPException(status_code=500, detail=str(e))

# 7. 장소 정보(사진, 좌표, 별점) 조회 API
@app.post("/api/get-place-details")
async def get_place_details(request: PlaceDetailRequest):
    if not MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Server Maps API Key not configured")

    # Google Places API (New) Text Search URL
    url = "https://places.googleapis.com/v1/places:searchText"
    
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAPS_API_KEY,
        # 필요한 필드만 골라서 요청 (비용 절약)
        "X-Goog-FieldMask": "places.id,places.formattedAddress,places.rating,places.photos,places.location" 
    }
    
    payload = {
        "textQuery": request.placeName
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        if "places" in data and len(data["places"]) > 0:
            place = data["places"][0]
            
            # 사진 URL 생성 (사진이 있다면)
            photo_url = None
            if "photos" in place and len(place["photos"]) > 0:
                photo_ref = place["photos"][0]["name"] # 'places/PLACE_ID/photos/PHOTO_ID' 형식
                # 최대 너비 400px로 이미지 요청 URL 생성
                photo_url = f"https://places.googleapis.com/v1/{photo_ref}/media?maxHeightPx=400&maxWidthPx=400&key={MAPS_API_KEY}"

            return {
                "found": True,
                "address": place.get("formattedAddress", ""),
                "rating": place.get("rating", 0),
                "location": place.get("location", {"latitude": 0, "longitude": 0}), # 위도, 경도
                "photoUrl": photo_url
            }
        else:
            return {"found": False}

    except Exception as e:
        print(f"Places API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
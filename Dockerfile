# --------------------------------------------------------
# 1단계: Frontend Build (Node.js 환경)
# --------------------------------------------------------
FROM node:20-alpine as build-stage

WORKDIR /app

# 클라이언트 패키지 파일 복사 및 설치
COPY client/package*.json ./client/
RUN cd client && npm install

# 클라이언트 소스 복사 및 빌드 (결과물: /app/client/dist)
COPY client/ ./client/

# Build-time frontend envs (pass via --build-arg)
ARG VITE_API_BASE_URL=/api
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_GOOGLE_MAPS_API_KEY

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}
ENV VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}
ENV VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}
ENV VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET}
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID}
ENV VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}
ENV VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY}

RUN test -n "$VITE_FIREBASE_API_KEY" && \
    test -n "$VITE_FIREBASE_AUTH_DOMAIN" && \
    test -n "$VITE_FIREBASE_PROJECT_ID" && \
    test -n "$VITE_FIREBASE_STORAGE_BUCKET" && \
    test -n "$VITE_FIREBASE_MESSAGING_SENDER_ID" && \
    test -n "$VITE_FIREBASE_APP_ID" && \
    test -n "$VITE_GOOGLE_MAPS_API_KEY"

RUN cd client && npm run build

# --------------------------------------------------------
# 2단계: Backend Setup (Python 환경)
# --------------------------------------------------------
FROM python:3.11-slim

WORKDIR /app

# 파이썬 의존성 설치
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 서버 소스 코드 복사
COPY server/ ./server/

# ★중요★ 1단계에서 빌드한 React 결과물을 FastAPI가 읽을 수 있는 폴더로 복사
# FastAPI 코드에서 설정한 경로("server/static")로 복사합니다.
COPY --from=build-stage /app/client/dist ./server/static

# --------------------------------------------------------
# 3단계: 실행 명령
# --------------------------------------------------------
# Cloud Run은 8080 포트를 기본으로 사용합니다.
ENV PORT=8080

# uvicorn 실행 (server 폴더의 main.py 내의 app 객체 실행)
# 경로는 프로젝트 구조에 따라 'server.main:app' 등으로 수정 필요할 수 있음
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8080"]

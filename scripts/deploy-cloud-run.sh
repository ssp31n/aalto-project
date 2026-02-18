#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.deploy.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  echo "Run: cp .deploy.env.example .deploy.env"
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "gcloud project is not set. Run: gcloud config set project <PROJECT_ID>"
  exit 1
fi

required_vars=(
  SERVICE_NAME
  REGION
  GCP_LOCATION
  VITE_API_BASE_URL
  CORS_ALLOW_ORIGINS
  VITE_FIREBASE_API_KEY
  VITE_FIREBASE_AUTH_DOMAIN
  VITE_FIREBASE_PROJECT_ID
  VITE_FIREBASE_STORAGE_BUCKET
  VITE_FIREBASE_MESSAGING_SENDER_ID
  VITE_FIREBASE_APP_ID
  VITE_GOOGLE_MAPS_API_KEY
  SERVER_GOOGLE_MAPS_API_KEY
)

for name in "${required_vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env: ${name}"
    exit 1
  fi
done

IMAGE_TAG="${IMAGE_TAG:-}"
if [[ -z "${IMAGE_TAG}" ]]; then
  IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
fi

gcloud builds submit "${ROOT_DIR}" \
  --config "${ROOT_DIR}/cloudbuild.yaml" \
  --substitutions="_SERVICE_NAME=${SERVICE_NAME},_IMAGE_TAG=${IMAGE_TAG},_REGION=${REGION},_GCP_LOCATION=${GCP_LOCATION},_VITE_API_BASE_URL=${VITE_API_BASE_URL},_CORS_ALLOW_ORIGINS=${CORS_ALLOW_ORIGINS},_VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY},_VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN},_VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID},_VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET},_VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID},_VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID},_VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY},_SERVER_GOOGLE_MAPS_API_KEY=${SERVER_GOOGLE_MAPS_API_KEY}"

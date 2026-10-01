# CALM FIT Render 배포

## 1) GitHub
`package.json`, `server.ts`, `src/`, `render.yaml`이 저장소 루트에 오도록 업로드합니다. 실제 `.env`는 올리지 않습니다.

## 2) Render Web Service
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`

## 3) Render 환경변수
필수:
- `CALMFIT_ACCESS_TOKEN` : 64자리 hex, 대시보드/웹소켓 인증용
- `CALMFIT_DEVICE_TOKEN` : 별도의 64자리 hex, ESP32 텔레메트리 인증용
- `CALMFIT_DATA_ENCRYPTION_KEY` : 64자리 hex, AES-256-GCM 데이터 암호화용
- `GEMINI_API_KEY` : 서버 전용 Gemini 키
- `PUBLIC_BASE_URL` : 예 `https://calm-fit-xxxx.onrender.com`
선택:
- `CALMFIT_ALLOWED_ORIGINS` : 추가 허용 Origin을 쉼표로 구분
- `DATA_DIR` : 기본값 `data`

## 4) ESP32
공개 서버에는 `https://YOUR-DOMAIN/api/telemetry`로 보내고 `X-CALMFIT-DEVICE-TOKEN` 헤더를 사용합니다. 대시보드 토큰을 ESP32에 재사용하지 마세요.
WebSocket은 `wss://YOUR-DOMAIN/ws`입니다.

## 5) 개인정보 보호 체크
- 실제 `.env` 제거
- 공개 Origin만 CORS 허용
- API Bearer 토큰 인증
- ESP32 전용 토큰 인증
- 데이터 AES-256-GCM 암호화 저장
- AI에 필요 이상의 직접 식별정보를 보내지 않기
- 원본 음성 파일을 서버에 저장하지 않기

주의: Render의 일반 파일 시스템은 영구 저장이 아닐 수 있으므로 실제 운영에서 14일 데이터를 계속 보존해야 한다면 영구 디스크 또는 데이터베이스를 추가로 구성해야 합니다.

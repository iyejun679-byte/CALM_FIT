# CALM FIT (캄핏) - XIAO ESP32-S3 Wi-Fi 텔레메트리 시스템

본 프로젝트는 발달장애(ASD) 감각 과부하 및 상동행동(Stimming) 모니터링을 위한 센서 밴드 대시보드 시스템입니다.

## 📡 통신 구조

```
Seeed Studio XIAO ESP32-S3 Sense 
  └── MAX30102 (심박/맥파 I2C)
  └── GY-61 ADXL335 (3축 아날로그 가속도)
  └── 내장 PDM 마이크
       │ (Wi-Fi 무선 전송, HTTP POST JSON, 200ms)
       ▼
CALM FIT 로컬 서버 (Node.js / Express + WebSocket, 포트 3000)
       │ (WebSocket /ws & SSE 실시간 브로드캐스트)
       ▼
CALM FIT 웹 대시보드 (React + Tailwind + Recharts)
```

---

## 🛠 하드웨어 핀 연결 (Seeed Studio XIAO ESP32-S3 Sense)

| 센서 모듈 | 센서 핀 | XIAO ESP32-S3 연결 핀 | 비고 |
|:---|:---|:---|:---|
| **MAX30102** | SDA | **D4 (GPIO 5)** | I2C 데이터 (주소 0x57) |
| **MAX30102** | SCL | **D5 (GPIO 6)** | I2C 클럭 (400kHz Fast I2C) |
| **MAX30102** | VIN / GND | 3V3 / GND | 전원 공급 |
| **GY-61** | X-OUT | **D0 (GPIO 1)** | 12비트 ADC 아날로그 입력 |
| **GY-61** | Y-OUT | **D1 (GPIO 2)** | 12비트 ADC 아날로그 입력 |
| **GY-61** | Z-OUT | **D2 (GPIO 3)** | 12비트 ADC 아날로그 입력 |
| **GY-61** | VCC / GND | 3V3 / GND | 전원 공급 |
| **내장 마이크** | CLK / DATA | **GPIO 42 / GPIO 41** | XIAO Sense 확장 보드 내장 |

---

## 🚀 빠른 시작 가이드

### 1. 서버 실행
처음 실행할 때 보안 키가 자동으로 만들어집니다. 터미널에서 아래 명령어 하나로 로컬 서버와 웹 앱을 실행하세요:
```bash
npm run dev
```
- 브라우저에서 `http://localhost:3000`을 열면 같은 컴퓨터에서는 접근 인증도 자동으로 처리됩니다.
- 자동으로 만든 `.env` 파일은 암호화 키를 담고 있으니 삭제하지 마세요. 이 파일은 Git에 올라가지 않습니다.
- 공개 서버에 배포할 때만 보호자/담당자가 Render 보안 환경변수 설정을 해야 합니다. 자세한 내용은 [DEPLOY_RENDER.md](DEPLOY_RENDER.md)를 참고하세요.
- 공개 네트워크에서는 HTTPS/WSS를 사용하세요. 프로덕션 서버는 TLS가 아닌 민감 API 요청을 거부합니다.
- 서버 엔드포인트: `http://0.0.0.0:3000`
- 센서 데이터 수신 API: `POST http://0.0.0.0:3000/api/telemetry`
- 웹소켓 스트림: `ws://0.0.0.0:3000/ws`

### 2. 컴퓨터 로컬 IP 확인
- 학교 로컬 IP: **`192.168.0.22`** (포트: `3000`)
- 웹 대시보드 상단 배너에서도 감지된 수신 엔드포인트(`http://192.168.0.22:3000/api/telemetry`)가 안내됩니다.

### 3. XIAO ESP32-S3 아두이노 스케치 설정
웹 앱 내 **[ESP32 Wi-Fi 코드]** 버튼을 눌러 스케치를 복사한 후 아두이노 IDE에서 Wi-Fi 정보만 입력하고 바로 업로드하면 됩니다:
```cpp
const char* WIFI_SSID     = "YOUR_WIFI_NAME";       // 학교 2.4GHz Wi-Fi 이름
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // Wi-Fi 비밀번호
const char* SERVER_URL    = "http://192.168.0.22:3000/api/telemetry"; // 학교 로컬 서버 IP
```

### 4. 아두이노 라이브러리 설치 (Arduino IDE 라이브러리 관리자)
- **SparkFun MAX3010x Pulse and Proximity Sensor Library**
- **ArduinoJson** (v6 또는 v7)

### 5. 업로드 및 동작 확인
1. 보드로 업로드 후 시리얼 모니터(115200 bps)에서 `Wi-Fi 연결 성공! IP: 192.168.x.x` 확인
2. 웹 대시보드에서 `ESP32 Wi-Fi 연결`을 클릭하면 센서 데이터가 실시간 스트리밍됩니다!


## 개인정보 보호 및 공개 배포
- 실제 `.env` 파일과 비밀값은 저장소에 포함하지 마세요.
- `CALMFIT_ACCESS_TOKEN`은 대시보드 API/웹소켓용, `CALMFIT_DEVICE_TOKEN`은 ESP32 텔레메트리 전용으로 분리합니다.
- 공개 배포에서는 HTTPS/WSS만 사용합니다.
- 14일 분석은 14개 일차가 모두 실제 데이터로 완료되고 각 일차에 실제 심박수 샘플이 확인될 때만 개인화 분석으로 인정합니다.
- 서버는 AI 응답이 실패하면 이를 AI 생성 결과로 저장하지 않습니다.
- 원본 음성 파일은 서버에 저장하지 않는 구조를 유지하고, 가능한 경우 음성 분류 결과만 전송합니다.
- 이 프로젝트는 보호자/교사용 지원 도구 프로토타입이며 의료 진단이나 치료 결과를 보장하지 않습니다.

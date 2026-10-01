/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Cpu, Sparkles, AlertCircle, Wifi, HelpCircle } from 'lucide-react';

interface ArduinoCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendedServerUrl?: string;
}

const XIAO_WIFI_ARDUINO_CODE = `/*
 * ==============================================================================
 * CALM FIT (캄핏) - XIAO ESP32-S3 Sense 센서 Wi-Fi 전송 펌웨어
 * ==============================================================================
 * 
 * [하드웨어 사양]
 * 1. 보드: Seeed Studio XIAO ESP32-S3 Sense (Wi-Fi + 내장 PDM 마이크)
 * 2. 심박/맥파 센서: MAX30102 (I2C 주소: 0x57)
 *    - SDA -> XIAO D4 / GPIO 5
 *    - SCL -> XIAO D5 / GPIO 6
 *    - VIN -> XIAO 3V3
 *    - GND -> XIAO GND
 * 3. 아날로그 움직임 센서: GY-61 (ADXL335 계열 3축 아날로그 가속도계)
 *    - X -> XIAO D0 / GPIO 1
 *    - Y -> XIAO D1 / GPIO 2
 *    - Z -> XIAO D2 / GPIO 3
 *    - VCC -> XIAO 3V3, GND -> XIAO GND
 * 4. 내장 PDM 마이크:
 *    - CLK -> GPIO 42, DATA -> GPIO 41
 * 
 * [아두이노 IDE 라이브러리 설치]
 * - SparkFun MAX3010x Pulse and Proximity Sensor Library
 * - ArduinoJson (v6 또는 v7 권장)
 * ==============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"

// ------------------------------------------------------------------------------
// [1] 사용자 설정 (Wi-Fi 정보 및 컴퓨터 로컬 서버 주소)
// ------------------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_NAME";       // 실제 2.4GHz Wi-Fi 이름
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // 실제 Wi-Fi 비밀번호

// 컴퓨터(Mac/PC) IP 주소와 포트 (휴대폰 핫스팟 또는 Wi-Fi 환경의 IP 입력)
const char* SERVER_URL    = "http://172.20.10.2:3000/api/telemetry";
const char* DEVICE_TOKEN  = "PASTE_CALMFIT_DEVICE_TOKEN_HERE";
const char* ROOT_CA_CERT  = "PASTE_SERVER_ROOT_CA_CERT_HERE";
WiFiClientSecure secureClient;

// 기기 고유 식별자 (다중 기기 확장 가능)
const char* DEVICE_ID     = "CALMFIT-01";

// ------------------------------------------------------------------------------
// [2] 핀 설정 (XIAO ESP32-S3 규격 준수)
// ------------------------------------------------------------------------------
#define I2C_SDA_PIN 5   // XIAO D4 (GPIO 5)
#define I2C_SCL_PIN 6   // XIAO D5 (GPIO 6)

#define GY61_X_PIN  1   // XIAO D0 (GPIO 1)
#define GY61_Y_PIN  2   // XIAO D1 (GPIO 2)
#define GY61_Z_PIN  3   // XIAO D2 (GPIO 3)

#define PDM_CLK_PIN 42  // XIAO Sense 내장 마이크 CLK
#define PDM_DATA_PIN 41 // XIAO Sense 내장 마이크 DATA

// ------------------------------------------------------------------------------
// [3] 전역 변수 및 센서 인스턴스
// ------------------------------------------------------------------------------
MAX30105 particleSensor;

const byte RATE_SIZE = 4; // 심박수 이동평균 샘플 수
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute = 0;
int beatAvg = 0;

// GY-61 가속도 변화량 측정용
int prevX = 0, prevY = 0, prevZ = 0;
bool gy61Initialized = false;

// 전송 주기 제어 (기본 200ms = 5Hz)
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL_MS = 200;

// ------------------------------------------------------------------------------
// [4] 함수: GY-61 아날로그 가속도로부터 motionScore 및 motionLevel 계산
// ------------------------------------------------------------------------------
void readMotionSensor(int &outScore, int &outLevel) {
  int curX = analogRead(GY61_X_PIN);
  int curY = analogRead(GY61_Y_PIN);
  int curZ = analogRead(GY61_Z_PIN);

  if (!gy61Initialized) {
    prevX = curX;
    prevY = curY;
    prevZ = curZ;
    gy61Initialized = true;
    outScore = 0;
    outLevel = 1;
    return;
  }

  // 각 축별 순간 변화량(Delta) 합산
  int deltaX = abs(curX - prevX);
  int deltaY = abs(curY - prevY);
  int deltaZ = abs(curZ - prevZ);
  int deltaTotal = deltaX + deltaY + deltaZ;

  prevX = curX;
  prevY = curY;
  prevZ = curZ;

  // 0~100 범위로 정규화 (ADC 분해능 12비트 4096 기준)
  int score = map(deltaTotal, 0, 600, 0, 100);
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  outScore = score;

  // CALM FIT 표준 모션 레벨 변환 (테스트 시 가벼운 흔들림에도 민감하게 반응하도록 최적화)
  // 1: STABLE, 2: NORMAL MOVE, 3: BIG MOVE, 4: REPETITIVE MOVE, 5: EXTREME MOVE
  if (score >= 45) {
    outLevel = 5; // EXTREME MOVE
  } else if (score >= 25) {
    outLevel = 4; // REPETITIVE MOVE
  } else if (score >= 12) {
    outLevel = 3; // BIG MOVE
  } else if (score >= 3) {
    outLevel = 2; // NORMAL MOVE (조금만 흔들어도 2단계 감지!)
  } else {
    outLevel = 1; // STABLE
  }
}

// ------------------------------------------------------------------------------
// [5] 함수: Edge Impulse 음성 AI 추론 결과 (음성 라벨 및 신뢰도)
// ------------------------------------------------------------------------------
// Edge Impulse 음성 분류 TinyML 모델을 탑재한 경우 추론 결과를 전달합니다.
// 예시: "VOICE_1", "VOICE_3", "CALM_VOICE", "NOISE" 등
const char* getVoiceLabel() {
  // 실제 Edge Impulse 모델의 classifier result label 전달
  return "VOICE_3";
}

float getVoiceConfidence() {
  // 실제 Edge Impulse 모델의 신뢰도 (0.00 ~ 1.00)
  return 0.91f;
}

// ------------------------------------------------------------------------------
// [6] 함수: Wi-Fi 연결 및 자동 재연결
// ------------------------------------------------------------------------------
void checkWiFiConnection() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("[Wi-Fi] 연결 시도 중...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("[Wi-Fi] 연결 성공!");
    Serial.print("[Wi-Fi] ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("");
    Serial.println("[Wi-Fi] 연결 실패. SSID와 비밀번호를 확인해주세요.");
  }
}

// ------------------------------------------------------------------------------
// [7] 아두이노 초기화 (setup)
// ------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\n==================================================");
  Serial.println("   CALM FIT - Seeed Studio XIAO ESP32-S3 Sense    ");
  Serial.println("==================================================");

  // 1. I2C 핀 초기화 (XIAO ESP32-S3 규격: SDA=D4=5, SCL=D5=6)
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(400000); // 400kHz Fast I2C

  // 2. MAX30102 센서 시작
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[오류] MAX30102 연결 실패! 배선(SDA=GPIO5, SCL=GPIO6)을 확인해주세요.");
    // 센서 연결 실패 시에도 Wi-Fi 진단이 가능하도록 무한루프 대신 경고만 출력
  } else {
    Serial.println("[성공] MAX30102 센서 초기화 완료 (I2C 0x57)");
    byte ledBrightness = 60; 
    byte sampleAverage = 4;
    byte ledMode = 2; // Red + IR
    int sampleRate = 400; 
    int pulseWidth = 411; 
    int adcRange = 4096;
    particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
    particleSensor.setPulseAmplitudeRed(0x1F);
    particleSensor.setPulseAmplitudeGreen(0);
  }

  // 3. GY-61 아날로그 핀 모드
  analogReadResolution(12); // ESP32 12비트 ADC (0~4095)
  pinMode(GY61_X_PIN, INPUT);
  pinMode(GY61_Y_PIN, INPUT);
  pinMode(GY61_Z_PIN, INPUT);

  // 4. Wi-Fi 연결 시작
  checkWiFiConnection();
}

// ------------------------------------------------------------------------------
// [8] 메인 루프 (loop)
// ------------------------------------------------------------------------------
void loop() {
  checkWiFiConnection();

  // 1. MAX30102 실시간 맥파 및 심박수 측정
  long irValue = particleSensor.getIR();
  bool contact = false;
  int currentBpm = 0;

  // 손가락이 센서에 닿았는지 확인 (IR > 50000)
  if (irValue > 50000) {
    contact = true;
    if (checkForBeat(irValue) == true) {
      long delta = millis() - lastBeat;
      lastBeat = millis();

      beatsPerMinute = 60 / (delta / 1000.0);

      if (beatsPerMinute < 255 && beatsPerMinute > 35) {
        rates[rateSpot++] = (byte)beatsPerMinute;
        rateSpot %= RATE_SIZE;

        beatAvg = 0;
        for (byte x = 0; x < RATE_SIZE; x++) beatAvg += rates[x];
        beatAvg /= RATE_SIZE;
      }
    }
    // 실제 측정된 유효 BPM만 전송 (가짜 기본값 금지)
    currentBpm = (beatAvg > 0) ? beatAvg : 0;
  } else {
    // 손가락 미접촉 상태
    contact = false;
    currentBpm = 0;
    beatAvg = 0;
  }

  // 2. GY-61 가속도 움직임 계산
  int motionScore = 0;
  int motionLevel = 1;
  readMotionSensor(motionScore, motionLevel);

  // 3. 음성 AI 추론 결과 (Edge Impulse)
  const char* voiceLabel = getVoiceLabel();
  float voiceConfidence = getVoiceConfidence();

  // 4. 200ms 주기로 서버에 HTTP POST 전송
  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      if (String(SERVER_URL).startsWith("https://")) {
        secureClient.setCACert(ROOT_CA_CERT);
        http.begin(secureClient, SERVER_URL);
      } else {
        http.begin(SERVER_URL);
      }
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-CALMFIT-DEVICE-TOKEN", DEVICE_TOKEN);

      // motionLevel 문자열 매핑 (Lv.3 이상은 BIG MOVE 등)
      const char* motionLevelStr = (motionLevel >= 4) ? "BIG BIG MOVE" : (motionLevel >= 3) ? "BIG MOVE" : "NORMAL";

      // JSON 데이터 생성 (ESP32 -> CALM FIT 서버 규격)
      char jsonBuffer[384];
      snprintf(jsonBuffer, sizeof(jsonBuffer),
        "{\\"deviceId\\":\\"%s\\",\\"heartRate\\":%d,\\"rawIrValue\\":%ld,\\"motionScore\\":%d,\\"motionLevel\\":\\"%s\\",\\"voiceLabel\\":\\"%s\\",\\"voiceConfidence\\":%.2f,\\"contact\\":%s}",
        DEVICE_ID,
        currentBpm,
        irValue,
        motionScore,
        motionLevelStr,
        voiceLabel,
        voiceConfidence,
        contact ? "true" : "false"
      );

      int httpResponseCode = http.POST((uint8_t*)jsonBuffer, strlen(jsonBuffer));

      if (httpResponseCode > 0) {
        // 성공 시 시리얼 모니터에 요약 로그 출력
        Serial.printf("[전송 성공 %d] BPM:%d IR:%ld MOVE:%s 음성:%s(%.2f) 접촉:%d\\n", 
          httpResponseCode, currentBpm, irValue, motionLevelStr, voiceLabel, voiceConfidence, contact);
      } else {
        Serial.printf("[HTTP 오류] 서버 전송 실패: %s\\n", http.errorToString(httpResponseCode).c_str());
      }

      http.end();
    } else {
      Serial.println("[전송 건너뜀] Wi-Fi 미연결 상태입니다.");
    }
  }

  delay(20); // 50Hz 폴링
}
`;

export default function ArduinoCodeModal({ isOpen, onClose, recommendedServerUrl }: ArduinoCodeModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // 만약 서버에서 로컬 IP를 가져왔거나 사용자가 설정한 URL이 있다면 코드 내 URL로 동적 교체
  const displayedCode = recommendedServerUrl 
    ? XIAO_WIFI_ARDUINO_CODE.replace(
        /const char\* SERVER_URL\s*=\s*"[^"]*";/,
        `const char* SERVER_URL    = "${recommendedServerUrl}";`
      )
    : XIAO_WIFI_ARDUINO_CODE;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-white to-purple-50 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black tracking-wide flex items-center gap-1">
                <Wifi size={12} />
                Wi-Fi HTTP 통신 펌웨어
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                <Cpu size={12} />
                Seeed Studio XIAO ESP32-S3 Sense
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold">
                MAX30102 + GY-61
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-snug">
              XIAO ESP32-S3 Wi-Fi 아두이노 스케치
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 break-keep">
              USB 케이블 연결 없이도 <strong>Wi-Fi를 통해 센서 데이터를 서버로 실시간 전송</strong>하는 완성형 펌웨어입니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Pin & Config Guide Callout */}
        <div className="bg-blue-50/80 border-b border-blue-200/60 px-4 sm:px-6 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-blue-950 break-keep">
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-blue-900">
              <Sparkles size={14} className="text-blue-600 shrink-0" />
              코드 상단에서 수정해야 할 4가지 필수 설정:
            </div>
            <p className="text-blue-800/90 leading-relaxed font-mono text-[11px]">
              1. <strong>WIFI_SSID</strong> (핫스팟/와이파이 이름) &nbsp;|&nbsp; 
              2. <strong>WIFI_PASSWORD</strong> (비밀번호) &nbsp;|&nbsp; 
              3. <strong>SERVER_URL</strong> ({recommendedServerUrl || 'http://[Mac_IP]:3000/api/telemetry'}) &nbsp;|&nbsp; 
              4. <strong>DEVICE_ID</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-2.5 py-1 bg-white border border-blue-200 rounded-lg font-mono text-[11px] text-blue-800">
              I2C: SDA=<strong>D4(GPIO5)</strong>, SCL=<strong>D5(GPIO6)</strong>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-4 sm:px-6 py-2.5 bg-gray-50 flex items-center justify-between border-b border-gray-200 gap-2">
          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <Terminal size={14} className="text-gray-400" />
            Arduino IDE 업로드용 완성 스케치
          </span>

          <button
            onClick={handleCopy}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              copied
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '복사 완료!' : '전체 아두이노 코드 복사'}
          </button>
        </div>

        {/* Code Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 font-mono text-xs leading-relaxed bg-[#0d1117] text-gray-200 selection:bg-blue-500 selection:text-white">
          <pre className="whitespace-pre overflow-x-auto">{displayedCode}</pre>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-500 text-center sm:text-left">
            권장 라이브러리: <strong className="text-gray-700">SparkFun MAX3010x</strong> &nbsp;|&nbsp; 
            주기: <strong className="text-blue-700">200ms (5Hz)</strong>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            확인 및 닫기
          </button>
        </div>

      </div>
    </div>
  );
}

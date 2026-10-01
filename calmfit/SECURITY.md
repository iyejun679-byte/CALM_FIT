# CALM FIT 보안 메모

이 저장소에는 실제 비밀값을 넣지 않습니다. 공개 배포 시 `CALMFIT_ACCESS_TOKEN`, `CALMFIT_DEVICE_TOKEN`, `CALMFIT_DATA_ENCRYPTION_KEY`, `GEMINI_API_KEY`는 호스팅 서비스의 Secret Environment Variable로 관리합니다.

`CALMFIT_ACCESS_TOKEN`과 `CALMFIT_DEVICE_TOKEN`은 서로 다른 값을 사용하세요. 공개된 값으로 교체하지 마세요.

14일 데이터 파일은 AES-256-GCM으로 암호화해 저장합니다. 암호화 키가 없으면 서버는 민감 데이터 API를 제공하지 않습니다.

이 프로젝트의 기술적 조치는 개인정보 보호를 고려한 프로토타입 구현이며, 실제 서비스 운영 전에는 법률/개인정보보호 전문가 검토가 필요합니다.

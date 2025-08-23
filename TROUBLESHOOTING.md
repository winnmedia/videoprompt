# VideoPlanet 트러블슈팅 가이드

## 🔍 현재 발생한 문제들

### 1. 이미지 미리보기 생성 안됨
### 2. VEO3 모델 작동 안됨  
### 3. Seedance 영상 생성 안됨 (JSON 파싱 에러)

---

## 🛠️ 공식 문서 기반 해결 방법

### 1. 이미지 미리보기 생성 문제 해결

#### Google Cloud Vertex AI Imagen 공식 설정
```bash
# .env 파일에 다음 변수들이 설정되어 있는지 확인
IMAGEN_PROVIDER=google
GOOGLE_CLOUD_PROJECT=your_project_id
VERTEX_PROJECT_ID=your_project_id
VERTEX_LOCATION=us-central1
VERTEX_IMAGEN_MODEL=imagegeneration@002
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
```

#### Vertex AI 서비스 계정 설정 (공식 문서 기준)
1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 선택
2. IAM & Admin > Service Accounts에서 서비스 계정 생성
3. `Vertex AI User` 역할 부여
4. JSON 키 파일 다운로드
5. 환경변수 `GOOGLE_APPLICATION_CREDENTIALS_JSON`에 JSON 내용 설정

#### Vertex AI API 활성화
```bash
# Google Cloud CLI로 API 활성화
gcloud services enable aiplatform.googleapis.com
gcloud services enable compute.googleapis.com
```

#### 테스트 방법
```bash
# 이미지 미리보기 API 테스트
curl -X POST http://localhost:3000/api/imagen/preview \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a beautiful sunset", "size": "1024x1024"}'
```

---

### 2. VEO3 모델 작동 문제 해결

#### Google AI Studio VEO3 공식 설정
```bash
# .env 파일에 다음 변수들이 설정되어 있는지 확인
GOOGLE_AI_STUDIO_API_KEY=your_actual_api_key_here
VEO_PROVIDER=google
VEO_MODEL=veo-3.0-generate-preview
```

#### Google AI Studio API 키 획득 (공식 문서 기준)
1. [Google AI Studio](https://aistudio.google.com/) 접속
2. Google 계정으로 로그인
3. API Keys 메뉴에서 새 API 키 생성
4. VEO 모델 사용 권한 확인
5. API 할당량 및 제한 확인

#### VEO3 API 스펙 (공식 문서 기준)
- **엔드포인트**: `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:generateContent`
- **요청 본문**: `contents[].parts[].text` + `videoGenerationConfig`
- **지원 파라미터**: `aspectRatio`, `duration`, `personGeneration`

#### 테스트 방법
```bash
# VEO 비디오 생성 API 테스트
curl -X POST http://localhost:3000/api/veo/create \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a cat playing with a ball", "aspectRatio": "16:9", "duration": 8}'
```

---

### 3. Seedance 영상 생성 문제 해결

#### BytePlus ModelArk Ark v3 공식 설정
```bash
# .env 파일에 다음 변수들이 설정되어 있는지 확인
SEEDANCE_API_KEY=your_actual_api_key_here
SEEDANCE_API_BASE=https://ark.ap-southeast.bytepluses.com
SEEDANCE_MODEL=ep-your-actual-model-id-here
```

#### ModelArk API 설정 (공식 문서 기준)
1. [BytePlus ModelArk](https://ark.ap-southeast.bytepluses.com/) 접속
2. 계정 생성 및 로그인
3. API Keys 메뉴에서 API 키 발급
4. 엔드포인트 ID 확인 (ep-로 시작하는 형식)
5. API 할당량 및 제한 확인

#### Ark v3 API 스펙 (공식 문서 기준)
- **생성 엔드포인트**: `POST /api/v3/contents/generations/tasks`
- **상태 확인**: `GET /api/v3/contents/generations/tasks/{id}`
- **요청 본문**: `model`, `content[]`, `parameters`
- **지원 파라미터**: `aspect_ratio`, `duration`, `seed`, `quality`

#### 테스트 방법
```bash
# Seedance 영상 생성 API 테스트
curl -X POST http://localhost:3000/api/seedance/create \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a beautiful landscape", "aspect_ratio": "16:9", "duration_seconds": 8}'
```

---

## 🔧 공식 문서 기반 디버깅 방법

### Google Cloud Vertex AI
```bash
# Vertex AI API 상태 확인
gcloud ai operations list --region=us-central1

# 서비스 계정 권한 확인
gcloud projects get-iam-policy your-project-id
```

### Google AI Studio
```bash
# API 키 유효성 확인
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://generativelanguage.googleapis.com/v1beta/models"
```

### ModelArk
```bash
# API 연결 테스트
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks"
```

---

## 📋 공식 문서 기반 체크리스트

### 이미지 미리보기 (Vertex AI)
- [ ] Google Cloud 프로젝트 생성 및 활성화
- [ ] Vertex AI API 활성화
- [ ] 서비스 계정 생성 및 권한 부여
- [ ] JSON 키 파일 다운로드
- [ ] 환경변수 설정 완료
- [ ] API 할당량 확인

### VEO3 모델 (Google AI Studio)
- [ ] Google AI Studio 계정 생성
- [ ] VEO 모델 접근 권한 확인
- [ ] API 키 생성 및 설정
- [ ] API 할당량 확인
- [ ] 네트워크 연결 확인

### Seedance 영상 생성 (ModelArk)
- [ ] ModelArk 계정 생성
- [ ] API 키 발급 및 설정
- [ ] 엔드포인트 ID 확인 (ep- 형식)
- [ ] API 할당량 확인
- [ ] 네트워크 연결 확인

---

## 🚨 공식 문서에서 확인된 일반적인 문제들

### Vertex AI Imagen
- **API 활성화 누락**: `aiplatform.googleapis.com` 서비스 미활성화
- **권한 부족**: 서비스 계정에 `Vertex AI User` 역할 미부여
- **리전 불일치**: `VERTEX_LOCATION`과 실제 API 호출 리전 불일치

### Google AI Studio VEO3
- **API 키 형식 오류**: 잘못된 형식의 API 키 사용
- **모델 접근 권한**: VEO 모델에 대한 접근 권한 부족
- **할당량 초과**: 일일 API 호출 제한 초과

### ModelArk Ark v3
- **엔드포인트 ID 오류**: `ep-`로 시작하지 않는 잘못된 모델 ID
- **API 버전 불일치**: v2 대신 v3 API 사용 필요
- **인증 헤더 오류**: `Authorization: Bearer` 형식 사용 필요

---

## 📞 공식 지원 채널

### Google Cloud
- [Google Cloud Support](https://cloud.google.com/support)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Community Support](https://stackoverflow.com/questions/tagged/google-cloud-platform)

### Google AI Studio
- [Google AI Studio Help](https://aistudio.google.com/help)
- [API Documentation](https://ai.google.dev/docs)
- [Community Forum](https://developers.google.com/community)

### BytePlus ModelArk
- [ModelArk Documentation](https://ark.ap-southeast.bytepluses.com/docs)
- [Support Email](mailto:support@byteplus.com)
- [Community Discord](https://discord.gg/byteplus)

---

*마지막 업데이트: 2025-01-23*
*공식 문서 기반 해결 방안 추가*

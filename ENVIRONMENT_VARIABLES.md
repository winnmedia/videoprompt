# VideoPlanet 환경변수 설정 가이드

## 📋 개요

VideoPlanet은 이미지 생성(Google Imagen)과 동영상 생성(Google Veo, Seedance)을 지원합니다. 각 기능별로 독립적인 환경변수를 사용하여 혼란을 방지합니다.

## 🔑 필수 환경변수

### **Google Gemini API 키**

```bash
GOOGLE_GEMINI_API_KEY=your_actual_api_key_here
```

- **용도**: Google Veo 3 동영상 생성 및 Google Imagen 이미지 생성
- **발급 방법**: https://aistudio.google.com/ → "Get API key"
- **현재 상태**: ✅ Railway에 설정됨

## 🖼️ 이미지 생성 설정 (Google Imagen)

### **Provider 설정**

```bash
IMAGEN_PROVIDER=google
```

- **가능한 값**: `google`, `openai`, `vertex`
- **기본값**: `google`
- **설명**: 이미지 생성을 위한 AI provider 선택

### **모델 설정**

```bash
IMAGEN_LLM_MODEL=imagen-4.0-fast-generate-preview-06-06
```

- **가능한 값**:
  - `imagen-4.0-fast-generate-preview-06-06` (권장, 최신)
  - `imagegeneration-004` (이전 버전)
  - `imagegeneration:generate` (이전 버전)
  - `imagen-2.0:generateImages` (이전 버전)
- **기본값**: `imagen-4.0-fast-generate-preview-06-06`
- **설명**: Google Imagen 4.0 Fast 모델 지정

### **Imagen 4.0 Fast 사양**

- **지원 해상도**: 1:1 (1024x1024), 3:4 (896x1280), 4:3 (1280x896), 9:16 (768x1408), 16:9 (1408x768)
- **프롬프트 언어**: 영어, 중국어(간체/번체), 힌디어, 일본어, 한국어, 포르투갈어, 스페인어
- **한도**: 분당 최대 20개 API 요청, 요청당 최대 4개 이미지, 최대 480 토큰
- **특징**: 디지털 워터마킹, 안전 설정, 프롬프트 수정 도구 지원

## 🎬 동영상 생성 설정

### **Google Veo 3 설정**

#### **Provider 활성화**

```bash
VEO_PROVIDER=google
```

- **가능한 값**: `google`, `enabled`, `disabled`
- **기본값**: `google`
- **설명**: Veo 3 동영상 생성 활성화/비활성화

#### **모델 선택**

```bash
VEO_MODEL=veo-3.0-generate-preview
```

- **가능한 값**:
  - `veo-3.0-generate-preview` (기본, 고품질)
  - `veo-3.0-fast-generate-preview` (빠른 생성)
  - `veo-2.0-generate-001` (Veo 2, 2초 동영상)
- **기본값**: `veo-3.0-generate-preview`
- **설명**: 사용할 Veo 모델 지정

### **Seedance/ModelArk 설정**

#### **API 키**

```bash
SEEDANCE_API_KEY=your_seedance_api_key_here
```

- **용도**: Seedance 동영상 생성
- **현재 상태**: ✅ Railway에 설정됨

#### **API 베이스 URL**

```bash
SEEDANCE_API_BASE=https://ark.ap-southeast.bytepluses.com
```

- **기본값**: `https://ark.ap-southeast.bytepluses.com`
- **설명**: ModelArk API 엔드포인트

#### **모델 ID**

```bash
SEEDANCE_MODEL=ep-your-model-id-here
```

- **형식**: `ep-xxxxxxxxx` (Endpoint ID)
- **설명**: 사용할 Seedance 모델

## 🚀 Railway 환경변수 설정

### **방법 1: Railway CLI 사용**

```bash
# Railway CLI 설치 및 로그인
npm install -g @railway/cli
railway login

# 프로젝트 연결
railway link

# 이미지 생성 설정
railway variables set IMAGEN_PROVIDER=google
railway variables set IMAGEN_LLM_MODEL=imagen-4.0-fast-generate-preview-06-06

# 동영상 생성 설정
railway variables set VEO_PROVIDER=google
railway variables set VEO_MODEL=veo-3.0-generate-preview
```

### **방법 2: Railway 웹 대시보드**

1. https://railway.app/ 접속
2. VideoPlanet 프로젝트 선택
3. **"Variables"** 탭 클릭
4. **"New Variable"** 클릭하여 추가

## 📊 현재 설정 상태

| 기능            | 환경변수            | 현재값    | 상태    | 설명                 |
| --------------- | ------------------- | --------- | ------- | -------------------- |
| **이미지 생성** | `IMAGEN_PROVIDER`   | ❌ 미설정 | ⚠️ 필요 | Google Imagen 활성화 |
| **이미지 생성** | `IMAGEN_LLM_MODEL`  | ❌ 미설정 | ⚠️ 필요 | Imagen 모델 지정     |
| **동영상 생성** | `VEO_PROVIDER`      | ❌ 미설정 | ⚠️ 필요 | Veo 3 활성화         |
| **동영상 생성** | `VEO_MODEL`         | ❌ 미설정 | ⚠️ 필요 | Veo 모델 지정        |
| **동영상 생성** | `SEEDANCE_API_KEY`  | ✅ 설정됨 | ✅ 완료 | Seedance API 인증    |
| **동영상 생성** | `SEEDANCE_API_BASE` | ✅ 설정됨 | ✅ 완료 | ModelArk 엔드포인트  |

## 🧪 설정 후 테스트

### **이미지 생성 테스트**

```bash
curl -X POST "https://videoprompt-production.up.railway.app/api/imagen/preview" \
  -H 'Content-Type: application/json' \
  --data '{"prompt":"A beautiful sunset","size":"1024x1024","n":1}'
```

### **Veo 3 동영상 생성 테스트**

```bash
curl -X POST "https://videoprompt-production.up.railway.app/api/video/create" \
  -H 'Content-Type: application/json' \
  --data '{"prompt":"A cinematic scene","provider":"veo","veoModel":"veo-3.0-generate-preview"}'
```

### **Seedance 동영상 생성 테스트**

```bash
curl -X POST "https://videoprompt-production.up.railway.app/api/video/create" \
  -H 'Content-Type: application/json' \
  --data '{"prompt":"A cinematic scene","provider":"seedance"}'
```

## 💡 권장 설정

### **개발 환경**

```bash
IMAGEN_PROVIDER=google
IMAGEN_LLM_MODEL=imagen-4.0-fast-generate-preview-06-06
VEO_PROVIDER=google
VEO_MODEL=veo-3.0-generate-preview
```

### **프로덕션 환경**

```bash
IMAGEN_PROVIDER=google
IMAGEN_LLM_MODEL=imagen-4.0-fast-generate-preview-06-06
VEO_PROVIDER=google
VEO_MODEL=veo-3.0-generate-preview
```

## ⚠️ 주의사항

1. **환경변수 분리**: 이미지와 동영상 생성은 독립적인 환경변수 사용
2. **API 키 보안**: `GOOGLE_GEMINI_API_KEY`는 민감정보로 보호
3. **모델 호환성**: Veo 3는 8초 고정, Veo 2는 2초 고정
4. **지역 제한**: Veo 3는 EU, UK, Switzerland, MENA 지역에서 제한적

## 🔗 관련 문서

- [Google AI Studio](https://aistudio.google.com/) - API 키 발급
- [Veo 3 API 문서](https://ai.google.dev/gemini-api/docs/video) - 동영상 생성 가이드
- [Seedance/ModelArk](https://ark.ap-southeast.bytepluses.com/) - 동영상 생성 API

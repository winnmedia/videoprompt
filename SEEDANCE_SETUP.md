# Seedance/ModelArk API 설정 가이드 (배포 환경 전용)

## 🚀 **빠른 시작 (배포 환경 전용)**

### **1. 환경변수 설정**

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# Seedance/ModelArk API 설정 (배포 환경 전용)
SEEDANCE_API_KEY=your_actual_api_key_here
SEEDANCE_MODEL=ep-your-model-id-here
SEEDANCE_API_BASE=https://ark.ap-southeast.bytepluses.com

# 배포 환경 설정
NODE_ENV=production
NEXT_PUBLIC_ENABLE_DEBUG=false

# 파일 저장 설정 (선택사항)
LOCAL_STORAGE_PATH=./public/uploads
```

### **2. API 키 발급**

1. [BytePlus ModelArk](https://ark.ap-southeast.bytepluses.com)에 가입
2. 새 프로젝트 생성
3. API 키 발급 (`ep-...` 형식의 엔드포인트 ID 확인)
4. 사용량 및 제한 확인

### **3. 모델 선택**

현재 지원되는 모델:

- `seedance-1.0-pro`: 고품질 영상 생성 (권장)
- `seedance-1.0-lite`: 빠른 영상 생성
- 커스텀 엔드포인트: `ep-...` 형식

## 🔧 **배포 환경 설정**

### **Vercel 배포 환경**

```bash
# Vercel 환경변수 설정
SEEDANCE_API_KEY=your_prod_key
SEEDANCE_MODEL=ep-your-model-id
SEEDANCE_API_BASE=https://ark.ap-southeast.bytepluses.com
NODE_ENV=production
```

### **Railway 백엔드 환경**

```bash
# Railway 환경변수 설정
SEEDANCE_API_KEY=your_prod_key
SEEDANCE_MODEL=ep-your-model-id
SEEDANCE_API_BASE=https://ark.ap-southeast.bytepluses.com
NODE_ENV=production
```

### **Docker 배포 환경**

```bash
# Docker 환경변수 설정
ENV SEEDANCE_API_KEY=your_prod_key
ENV SEEDANCE_MODEL=ep-your-model-id
ENV SEEDANCE_API_BASE=https://ark.ap-southeast.bytepluses.com
ENV NODE_ENV=production
```

## 🧪 **테스트 및 검증**

### **1. Railway 백엔드 상태 확인**

```bash
# Railway 백엔드 상태 확인
curl https://videoprompt-production.up.railway.app/api/health

# Seedance 진단
curl https://videoprompt-production.up.railway.app/api/seedance/diagnose
```

### **2. 배포된 사이트에서 테스트**

1. Vercel에 배포된 사이트 접속
2. `/wizard` 페이지에서 영상 생성 테스트
3. 브라우저 개발자 도구에서 네트워크 요청 확인

### **3. 파일 저장 기능 테스트**

```bash
# 파일 저장 기능 테스트
./test-file-storage.sh

# 수동 테스트
curl -X POST http://localhost:3000/api/files/save \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com/test.jpg"], "prefix": "test-", "subDirectory": "images"}'
```

### **4. 통합 테스트**

```bash
# 전체 워크플로우 테스트
npm run test:integration
```

## 🚨 **문제 해결**

### **일반적인 문제들**

#### **1. "AuthenticationError" 발생**

- **원인**: API 키가 설정되지 않음 또는 잘못됨
- **해결**: 환경변수에 올바른 `SEEDANCE_API_KEY` 설정

#### **2. "Model not found" 에러**

- **원인**: 잘못된 모델 ID 또는 엔드포인트
- **해결**: `SEEDANCE_MODEL`을 올바른 `ep-...` 형식으로 설정

#### **3. "Request timeout" 에러**

- **원인**: 네트워크 연결 문제 또는 API 응답 지연
- **해결**: 타임아웃 설정 조정 (기본 60초)

#### **4. Railway 백엔드 연결 실패**

- **원인**: Railway 서비스 중단 또는 네트워크 문제
- **해결**: Railway 상태 확인 및 서비스 복구 대기

#### **5. 파일 저장 실패**

- **원인**: 디스크 공간 부족 또는 권한 문제
- **해결**: 업로드 디렉토리 권한 및 공간 확인

### **디버깅 방법**

#### **1. 로그 확인**

```bash
# 배포 환경 로그 확인
# Vercel: Vercel 대시보드 > Functions > Logs
# Railway: Railway 대시보드 > Deployments > Logs
```

#### **2. 환경변수 확인**

```bash
# Vercel 환경변수 확인
vercel env ls

# Railway 환경변수 확인
railway variables
```

#### **3. API 상태 확인**

```bash
# Railway 백엔드 상태 확인
curl https://videoprompt-production.up.railway.app/api/health

# Seedance 진단
curl https://videoprompt-production.up.railway.app/api/seedance/diagnose
```

#### **4. 파일 저장 상태 확인**

```bash
# 저장된 파일 확인
ls -la public/uploads/

# 디스크 공간 확인
df -h public/uploads/
```

## 📚 **API 스펙 참조**

### **생성 API**

- **엔드포인트**: `POST /api/v3/contents/generations/tasks`
- **요청 본문**:
  ```json
  {
    "model": "ep-your-model-id",
    "content": [
      {
        "type": "text",
        "text": "프롬프트 텍스트 --duration 8 --aspect 16:9"
      }
    ],
    "parameters": {
      "aspect_ratio": "16:9",
      "duration": 8,
      "seed": 12345,
      "quality": "standard"
    }
  }
  ```

### **상태 확인 API**

- **엔드포인트**: `GET /api/v3/contents/generations/tasks/{id}`
- **응답 구조**:
  ```json
  {
    "data": {
      "status": "processing|succeeded|failed",
      "progress": 75,
      "result": {
        "output": [
          {
            "url": "https://example.com/video.mp4"
          }
        ]
      }
    }
  }
  ```

### **파일 저장 API**

- **엔드포인트**: `POST /api/files/save`
- **요청 본문**:
  ```json
  {
    "urls": ["https://example.com/file.jpg"],
    "prefix": "custom-",
    "subDirectory": "images"
  }
  ```
- **응답 구조**:
  ```json
  {
    "ok": true,
    "message": "파일 저장 성공",
    "fileInfo": {
      "originalUrl": "https://example.com/file.jpg",
      "savedPath": "/uploads/images/custom-123456-abc123.jpg",
      "fileName": "custom-123456-abc123.jpg",
      "fileType": "image",
      "fileSize": 1024000,
      "savedAt": "2025-01-25T10:30:00.000Z",
      "mimeType": "image/jpeg"
    }
  }
  ```

## 🔒 **보안 고려사항**

1. **API 키 보호**: 환경변수에만 저장, 코드에 하드코딩 금지
2. **환경별 분리**: 개발/프로덕션 환경에 다른 API 키 사용
3. **사용량 모니터링**: ModelArk 대시보드에서 API 사용량 확인
4. **에러 로깅**: 민감한 정보가 로그에 노출되지 않도록 주의
5. **파일 저장 보안**: 업로드 디렉토리 접근 권한 제한

## 📁 **파일 저장 시스템**

### **저장 경로 구조**

```
public/uploads/
├── images/          # 이미지 파일
├── videos/          # 비디오 파일
└── audio/           # 오디오 파일
```

### **지원 파일 형식**

- **이미지**: JPG, JPEG, PNG, GIF, WebP
- **비디오**: MP4, AVI, MOV, WebM, MKV
- **오디오**: MP3, WAV, OGG, AAC

### **파일 크기 제한**

- **이미지**: 최대 10MB
- **비디오**: 최대 100MB
- **오디오**: 최대 50MB

### **자동 저장 기능**

- **Seedance 영상**: 생성 완료 시 자동 저장
- **Imagen 이미지**: 생성 완료 시 자동 저장
- **Veo 영상**: 생성 완료 시 자동 저장
- **백그라운드 처리**: 사용자 응답 지연 없음

## 📞 **지원 및 문의**

- **BytePlus ModelArk**: [공식 문서](https://ark.ap-southeast.bytepluses.com/docs)
- **API 상태**: [상태 페이지](https://status.byteplus.com)
- **지원 채널**: [고객 지원](https://support.byteplus.com)

## 🎯 **다음 단계**

1. ✅ 환경변수 설정
2. ✅ API 키 발급
3. ✅ 모델 선택
4. 🔄 API 테스트
5. 🔄 워크플로우 통합
6. 🔄 프로덕션 배포
7. 🔄 파일 저장 테스트

## ⚠️ **중요 사항**

- **Mock 모드 비활성화**: 배포 환경에서는 Mock 모드가 완전히 비활성화됩니다
- **직접 연결**: Railway 백엔드를 통한 직접 연결만 지원됩니다
- **에러 처리**: API 실패 시 적절한 에러 메시지와 함께 실패 응답을 반환합니다
- **타임아웃**: 배포 환경을 고려하여 60초 타임아웃이 설정됩니다
- **자동 저장**: 모든 생성된 파일이 자동으로 로컬에 저장됩니다
- **비동기 처리**: 파일 저장은 백그라운드에서 처리되어 사용자 응답을 지연시키지 않습니다

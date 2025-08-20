# MEMORY

## 2025-08-20

- Seedance(ModelArk) 연동
  - Provider(`src/lib/providers/seedance.ts`)를 BytePlus ModelArk 비디오 생성 API 스펙에 맞게 구현
    - 생성: POST /modelark/video_generation/tasks (model, input.prompt, parameters)
    - 상태: GET /modelark/video_generation/tasks/{id} (data.status/progress/result.video_url 파싱)
    - 키: `SEEDANCE_API_KEY` 또는 `MODELARK_API_KEY` 지원, 베이스: `MODELARK_API_BASE` 선택
  - 위저드(`src/app/wizard/page.tsx`)
    - “SEEDANCE로 생성” 시 최종 프롬프트(veo3Preview) 우선 사용, 영문화 후 전송
    - 단일/영화팩 모두 상태 폴링 및 플레이어 표시 (지수 백오프)
    - 모델 기본값: `seedance-1.0-pro`

- 빌드/배포 안정화
  - /wizard: `useSearchParams` 제거 → CSR 파라미터 파싱, 빌드 에러 해결
  - API Route 핸들러: Next.js 타입 제약에 맞게 시그니처 정리

- 환경변수
  - Railway에 `SEEDANCE_API_KEY` 등록 완료 (사용자 보고)
  - 선택: `MODELARK_API_KEY`, `MODELARK_API_BASE`, `NEXT_PUBLIC_SITE_URL`



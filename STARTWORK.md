# 🚀 STARTWORK.md - VideoPlanet 작업 시작 가이드

> **목적**: 모든 개발 작업 시작 전 필수 체크리스트와 준비 절차를 제공합니다.  
> **원칙**: Plan → Do → See 사이클의 "Plan" 단계를 체계화합니다.

## 📚 Step 1: 필수 문서 숙지 (우선순위 순)

### 1.1 MEMORY.md 확인 ⭐⭐⭐
```bash
# 최근 작업 내역 확인 (상위 100줄)
head -n 100 MEMORY.md
```
- [ ] 최근 작업 내역 파악
- [ ] 현재 진행 중인 이슈 확인  
- [ ] 이전 결정 사항 검토
- [ ] 해결된 문제와 패턴 학습

### 1.2 CLAUDE.md 숙지 ⭐⭐⭐
- [ ] 프로젝트 특화 규칙 확인
- [ ] 테스트 전략 (TDD vs BDD) 이해
- [ ] UI/UX 디자인 토큰 확인
- [ ] 에러 처리 표준 숙지

### 1.3 Architecture_fsd.md 확인 ⭐⭐
- [ ] FSD 레이어 구조 이해
  - `app → processes → widgets → features → entities → shared`
- [ ] 의존성 규칙 확인 (상→하만 허용)
- [ ] Public API (index.ts) 원칙 이해
- [ ] 파일 배치 기준 숙지

### 1.4 Frontend_TDD.md 참고 ⭐
- [ ] Red → Green → Refactor 사이클 이해
- [ ] 테스트 우선 개발 루틴 확인
- [ ] 의존성 제거 전략 파악


**"좋은 시작이 반이다" - 체계적인 준비로 안정적인 개발을!** 🚀
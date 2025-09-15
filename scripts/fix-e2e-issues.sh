#!/bin/bash
# VideoPlanet E2E 문제 해결 스크립트

echo "🔧 VideoPlanet E2E 문제 해결 시작..."

# 1. 환경변수 템플릿 생성
echo "📝 환경변수 템플릿 생성 중..."
cat > .env.example.e2e << EOF
# E2E 테스트에 필요한 환경변수
# 실제 값으로 대체 후 .env.local에 추가하세요

# OpenAI API (스토리 생성용)
OPENAI_API_KEY=sk-your-actual-openai-api-key

# Google Gemini API (스토리보드 생성용)
GOOGLE_GEMINI_API_KEY=your-actual-gemini-api-key

# Seedance API (영상 생성용)
SEEDANCE_API_KEY=your-actual-seedance-api-key
SEEDANCE_MODEL=ep-your-actual-model-endpoint

# Supabase (이미 설정됨)
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
EOF

echo "✅ 환경변수 템플릿 생성: .env.example.e2e"

# 2. Supabase 버킷 생성 SQL 스크립트
echo "📦 Supabase Storage 설정 스크립트 생성..."
cat > supabase-storage-setup.sql << EOF
-- VideoPlanet Storage 버킷 설정
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. videos 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('videos', 'videos', true, 52428800); -- 50MB limit

-- 2. images 버킷 생성 (스토리보드용)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('images', 'images', true, 10485760); -- 10MB limit

-- 3. documents 버킷 생성 (PDF용)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', true, 10485760); -- 10MB limit

-- 4. 업로드 정책 설정
CREATE POLICY "Videos upload policy" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Videos public access" ON storage.objects
FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "Images upload policy" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'images');

CREATE POLICY "Images public access" ON storage.objects
FOR SELECT USING (bucket_id = 'images');

CREATE POLICY "Documents upload policy" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Documents public access" ON storage.objects
FOR SELECT USING (bucket_id = 'documents');

-- 5. 확인 쿼리
SELECT name, public, file_size_limit
FROM storage.buckets
WHERE name IN ('videos', 'images', 'documents');
EOF

echo "✅ Supabase Storage 설정 스크립트 생성: supabase-storage-setup.sql"

# 3. 환경변수 체크 스크립트
echo "🔍 환경변수 체크 스크립트 생성..."
cat > scripts/check-env.js << 'EOF'
#!/usr/bin/env node
/**
 * 환경변수 체크 스크립트
 */

const requiredEnvVars = [
  'GOOGLE_GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SEEDANCE_API_KEY',
  'SEEDANCE_MODEL'
];

console.log('🔍 환경변수 검증 시작...\n');

let missingVars = [];
let warnings = [];

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];

  if (!value) {
    missingVars.push(varName);
    console.log(`❌ ${varName}: 설정되지 않음`);
  } else if (value.includes('your-') || value.includes('sk-...')) {
    warnings.push(varName);
    console.log(`⚠️  ${varName}: 기본값 또는 플레이스홀더 값`);
  } else {
    console.log(`✅ ${varName}: 설정됨 (${value.substring(0, 20)}...)`);
  }
});

console.log('\n📊 검증 결과:');
console.log(`✅ 정상: ${requiredEnvVars.length - missingVars.length - warnings.length}`);
console.log(`⚠️  경고: ${warnings.length}`);
console.log(`❌ 누락: ${missingVars.length}`);

if (missingVars.length > 0) {
  console.log('\n❌ 누락된 환경변수:');
  missingVars.forEach(varName => {
    console.log(`  - ${varName}`);
  });
  console.log('\n해결방법: .env.local 파일에 위 변수들을 추가하세요.');
}

if (warnings.length > 0) {
  console.log('\n⚠️  확인 필요한 환경변수:');
  warnings.forEach(varName => {
    console.log(`  - ${varName}: 실제 API 키로 교체 필요`);
  });
}

process.exit(missingVars.length > 0 ? 1 : 0);
EOF

chmod +x scripts/check-env.js

echo "✅ 환경변수 체크 스크립트 생성: scripts/check-env.js"

# 4. E2E 테스트 실행 가이드
echo "📚 E2E 테스트 실행 가이드 생성..."
cat > E2E_SETUP_GUIDE.md << EOF
# 🚀 E2E 테스트 환경 설정 가이드

## 1️⃣ 환경변수 설정

\`\`\`bash
# 1. 환경변수 템플릿 복사
cp .env.example.e2e .env.local

# 2. 실제 API 키로 편집
nano .env.local

# 3. 환경변수 검증
node scripts/check-env.js
\`\`\`

## 2️⃣ Supabase Storage 설정

1. **Supabase Dashboard** 접속
2. **SQL Editor** 탭 클릭
3. \`supabase-storage-setup.sql\` 파일 내용 붙여넣기
4. **RUN** 버튼 클릭

## 3️⃣ E2E 테스트 실행

\`\`\`bash
# 환경변수 확인 후 테스트 실행
npm run dev  # 개발서버 실행 (별도 터미널)
node scripts/e2e-test.js  # E2E 테스트 실행
\`\`\`

## 4️⃣ 문제 해결

### OpenAI API 키 문제
- [OpenAI Platform](https://platform.openai.com/api-keys)에서 API 키 생성
- 결제 정보 등록 필요

### Gemini API 할당량 문제
- [Google AI Studio](https://makersuite.google.com/app/apikey)에서 키 확인
- 할당량 초과 시 대기 또는 유료 전환

### Seedance 모델 문제
- Seedance 플랫폼에서 모델 엔드포인트 확인
- \`ep-xxxxxx\` 형태의 모델 ID 필요

## 5️⃣ 성공 확인

모든 설정이 완료되면 다음과 같은 결과를 볼 수 있습니다:

\`\`\`
✅ 스토리 생성: 성공
✅ 스토리보드 생성: 성공
✅ PDF 다운로드: 성공
✅ 프롬프트 생성: 성공
✅ 영상 생성: 성공
✅ 업로드: 성공
\`\`\`
EOF

echo "✅ E2E 테스트 설정 가이드 생성: E2E_SETUP_GUIDE.md"

# 5. package.json 스크립트 추가 (선택사항)
echo "📦 package.json 스크립트 제안..."
echo ""
echo "다음 스크립트를 package.json에 추가하는 것을 권장합니다:"
echo ""
echo '"scripts": {'
echo '  "test:e2e": "node scripts/e2e-test.js",'
echo '  "check:env": "node scripts/check-env.js",'
echo '  "setup:e2e": "bash scripts/fix-e2e-issues.sh"'
echo '}'

echo ""
echo "🎉 E2E 문제 해결 스크립트 실행 완료!"
echo ""
echo "📋 다음 단계:"
echo "1. .env.example.e2e를 참고하여 .env.local 설정"
echo "2. supabase-storage-setup.sql을 Supabase Dashboard에서 실행"
echo "3. node scripts/check-env.js로 환경변수 검증"
echo "4. node scripts/e2e-test.js로 전체 테스트 실행"
echo ""
echo "📖 자세한 가이드: E2E_SETUP_GUIDE.md 참조"
EOF

chmod +x /home/winnmedia/videoprompt/scripts/fix-e2e-issues.sh
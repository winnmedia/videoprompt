/**
 * AI 기획 페이지 문제 진단을 위한 Node.js 스크립트
 */

const { exec } = require('child_process');

// 페이지 HTML 가져와서 분석
function fetchPageHTML() {
  return new Promise((resolve, reject) => {
    exec('curl -s http://localhost:3001/planning/create', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

// HTML에서 특정 요소들 분석
function analyzeHTML(html) {
  console.log('🔍 AI 기획 페이지 분석 시작\n');

  // Select 요소 개수 확인
  const selectMatches = html.match(/<select[^>]*>/g) || [];
  console.log(`📋 Select 요소 개수: ${selectMatches.length}`);

  // Input 요소 개수 확인
  const inputMatches = html.match(/<input[^>]*>/g) || [];
  console.log(`📝 Input 요소 개수: ${inputMatches.length}`);

  // Button 요소 개수 확인
  const buttonMatches = html.match(/<button[^>]*>/g) || [];
  console.log(`🔘 Button 요소 개수: ${buttonMatches.length}`);

  // 프리셋 버튼 확인
  const presetButtons = html.match(/브랜드 30초|다큐 90초|드라마 60초|액션 45초/g) || [];
  console.log(`🚀 프리셋 버튼 개수: ${presetButtons.length}`);

  // JavaScript 오류 패턴 확인
  const errorPatterns = [
    'SyntaxError',
    'ReferenceError',
    'TypeError',
    'undefined is not',
    'Cannot read property',
    'Cannot access before initialization'
  ];

  let hasErrors = false;
  errorPatterns.forEach(pattern => {
    if (html.includes(pattern)) {
      console.log(`❌ JavaScript 오류 발견: ${pattern}`);
      hasErrors = true;
    }
  });

  if (!hasErrors) {
    console.log('✅ 명백한 JavaScript 오류 없음');
  }

  // React 하이드레이션 문제 확인
  if (html.includes('hydration')) {
    console.log('⚠️ React 하이드레이션 관련 코드 발견');
  }

  // Next.js 에러 페이지 확인
  if (html.includes('Application error') || html.includes('404')) {
    console.log('❌ Next.js 에러 페이지가 렌더링됨');
  } else {
    console.log('✅ 정상적인 페이지 렌더링');
  }

  console.log('\n📊 분석 완료\n');
}

// 특정 문제점 확인
function checkCommonIssues(html) {
  console.log('🔎 일반적인 문제점 확인\n');

  // CSS 로딩 문제
  if (!html.includes('style') && !html.includes('css')) {
    console.log('⚠️ CSS가 로드되지 않았을 수 있음');
  }

  // JavaScript 번들 로딩 문제
  if (!html.includes('_next/static')) {
    console.log('⚠️ Next.js JavaScript 번들이 로드되지 않았을 수 있음');
  }

  // Form 요소 확인
  const formCount = (html.match(/<form[^>]*>/g) || []).length;
  console.log(`📋 Form 요소 개수: ${formCount}`);

  // React 앱 마운트 확인
  if (html.includes('__NEXT_DATA__')) {
    console.log('✅ Next.js 데이터 정상 로드');
  } else {
    console.log('❌ Next.js 데이터 로드 실패');
  }

  // 필수 아이콘 확인
  const iconCount = (html.match(/class="[^"]*h-5 w-5[^"]*"/g) || []).length;
  console.log(`🎨 아이콘 요소 개수: ${iconCount}`);
}

// 실행
async function main() {
  try {
    console.log('🚀 AI 기획 페이지 문제 진단 시작...\n');

    const html = await fetchPageHTML();

    analyzeHTML(html);
    checkCommonIssues(html);

    // HTML 샘플 저장
    require('fs').writeFileSync('planning-page-sample.html', html.substring(0, 5000));
    console.log('💾 HTML 샘플 저장됨: planning-page-sample.html');

    console.log('\n✨ 진단 완료!');

  } catch (error) {
    console.error('❌ 진단 실패:', error.message);
    process.exit(1);
  }
}

main();
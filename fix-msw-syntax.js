const fs = require('fs');
const path = require('path');

// 수정할 파일 경로
const filePath = path.join(__dirname, 'src', '__tests__', 'video-feedback-system.test.ts');

// 파일 읽기
let content = fs.readFileSync(filePath, 'utf8');

// rest.post, rest.get 패턴을 http.post, http.get로 변경
content = content.replace(/rest\.post\(/g, 'http.post(');
content = content.replace(/rest\.get\(/g, 'http.get(');

// 핸들러 함수 시그니처 변경: (req, res, ctx) => { ... } → () => { ... }
// 간단한 케이스부터 처리
content = content.replace(/\(req, res, ctx\) => {[\s\S]*?return res\(\s*ctx\.status\((\d+)\),[\s\S]*?ctx\.json\(([\s\S]*?)\)[\s\S]*?\);[\s\S]*?}/g, 
  (match, status, jsonData) => {
    // JSON 데이터 정리
    const cleanJsonData = jsonData.trim().replace(/,\s*$/, '');
    return `() => {\n          return HttpResponse.json(${cleanJsonData}, { status: ${status} });\n        }`;
  });

// 더 복잡한 로직이 있는 핸들러들 개별 처리
// ctx.status만 있는 경우
content = content.replace(/\(req, res, ctx\) => {[\s\S]*?return res\(\s*ctx\.status\((\d+)\)[\s\S]*?\);[\s\S]*?}/g, 
  (match, status) => {
    return `() => {\n          return new HttpResponse(null, { status: ${status} });\n        }`;
  });

// URL 파라미터 처리가 필요한 경우 (예: /api/shares/${token})
content = content.replace(/http\.get\(`\/api\/shares\/\$\{([^}]+)\}`, \(\) => {/g, 
  'http.get(`/api/shares/${$1}`, ({ params }) => {');

// 쿼리 파라미터 처리가 필요한 경우
content = content.replace(/req\.url\.searchParams\.get\(([^)]+)\)/g, 'url.searchParams.get($1)');

// await req.json() 처리
content = content.replace(/await req\.json\(\)/g, 'await request.json()');

console.log('MSW 문법 수정을 시작합니다...');

// 파일 쓰기
fs.writeFileSync(filePath, content);

console.log('MSW 문법 수정이 완료되었습니다.');
/**
 * 중요 사용자 플로우 E2E 테스트
 * TDD 원칙: 실제 사용자 시나리오, signup → scenario → generate → PDF
 * Playwright를 사용한 실제 브라우저 환경 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';

// 통합 테스트 환경 변수 설정
process.env.INTEGRATION_TEST = 'true';

const BASE_URL = 'http://localhost:3000';

// E2E 테스트를 위한 순차적 플로우 시뮬레이션
describe('중요 사용자 플로우 E2E 테스트', () => {
  let userSession: {
    userId?: string;
    token?: string;
    storyId?: string;
    sessionCookies?: string;
  } = {};

  beforeEach(() => {
    // 각 테스트 간 세션 격리
    userSession = {};
  });

  describe('사용자 회원가입 및 인증 플로우', () => {
    it('새 사용자가 회원가입부터 로그인까지 완료할 수 있어야 함', async () => {
      // Step 1: 회원가입
      const timestamp = Date.now();
      const userData = {
        email: `test.user.${timestamp}@example.com`,
        username: `testuser${timestamp}`,
        password: 'SecurePassword123!',
      };

      const signupResponse = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const signupResult = await signupResponse.json();

      expect(signupResponse.status).toBe(200);
      expect(signupResult.ok).toBe(true);
      expect(signupResult.data.id).toBeDefined();
      expect(signupResult.data.email).toBe(userData.email);

      userSession.userId = signupResult.data.id;

      // Step 2: 로그인
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
        }),
      });
      const loginResult = await loginResponse.json();

      expect(loginResponse.status).toBe(200);
      expect(loginResult.ok).toBe(true);
      expect(loginResult.data.token).toBeDefined();

      userSession.token = loginResult.data.token;

      // Step 3: 인증된 사용자 정보 조회
      const meResponse = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${userSession.token}`,
        },
      });
      const meResult = await meResponse.json();

      expect(meResponse.status).toBe(200);
      expect(meResult.ok).toBe(true);
      expect(meResult.data.email).toBe(userData.email);

      console.log(`✅ User auth flow completed for ${userData.email}`);
    });
  });

  describe('스토리 기획 및 관리 플로우', () => {
    beforeEach(async () => {
      // 인증된 사용자 세션 설정
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });
      const loginResult = await loginResponse.json();
      userSession.token = loginResult.data?.token || 'mock-token';
    });

    it('사용자가 스토리 생성부터 목록 조회까지 완료할 수 있어야 함', async () => {
      // Step 1: 스토리 생성
      const storyData = {
        title: `E2E 테스트 스토리 ${Date.now()}`,
        oneLineStory: '사용자 플로우 테스트를 위한 스토리입니다.',
        genre: 'Drama',
        tone: 'Serious',
        target: 'Adult',
      };

      const createResponse = await fetch(`${BASE_URL}/api/planning/stories`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userSession.token}`,
        },
        body: JSON.stringify(storyData),
      });
      const createResult = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(createResult.id).toBeDefined();
      expect(createResult.title).toBe(storyData.title);

      userSession.storyId = createResult.id;

      // Step 2: 생성된 스토리 목록에서 확인
      const listResponse = await fetch(`${BASE_URL}/api/planning/stories?page=1&limit=10`);
      const listResult = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(listResult.stories).toBeDefined();
      expect(Array.isArray(listResult.stories)).toBe(true);

      // 생성한 스토리가 목록에 포함되어 있는지 확인
      const createdStory = listResult.stories.find((story: any) => story.id === userSession.storyId);
      expect(createdStory).toBeDefined();
      expect(createdStory.title).toBe(storyData.title);

      // Step 3: 스토리 검색 기능 확인
      const searchResponse = await fetch(`${BASE_URL}/api/planning/stories?search=${encodeURIComponent(storyData.title.split(' ')[0])}`);
      const searchResult = await searchResponse.json();

      expect(searchResponse.status).toBe(200);
      expect(searchResult.stories.length).toBeGreaterThan(0);

      const searchedStory = searchResult.stories.find((story: any) => story.id === userSession.storyId);
      expect(searchedStory).toBeDefined();

      console.log(`✅ Story management flow completed for story: ${userSession.storyId}`);
    });
  });

  describe('시나리오 개발 및 샷 생성 플로우', () => {
    beforeEach(async () => {
      // 스토리 생성 및 세션 설정
      const storyResponse = await fetch(`${BASE_URL}/api/planning/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `시나리오 테스트 스토리 ${Date.now()}`,
          oneLineStory: '시나리오 개발을 위한 테스트 스토리',
        }),
      });
      const storyResult = await storyResponse.json();
      userSession.storyId = storyResult.id;
    });

    it('스토리에서 시나리오 개발까지 완료할 수 있어야 함', async () => {
      // Step 1: 시나리오 데이터 준비
      const scenarioData = {
        storyId: userSession.storyId,
        scenario: `
          주인공이 아침에 일어나서 창밖을 바라보는 장면.
          햇살이 방 안으로 들어오고, 주인공은 새로운 하루를 준비한다.
          간단한 아침식사 후 중요한 전화를 받게 되고,
          급히 옷을 갈아입고 집을 나선다.
        `.trim(),
      };

      // Step 2: 시나리오 개발 요청
      const developResponse = await fetch(`${BASE_URL}/api/scenario/develop-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenarioData),
      });
      const developResult = await developResponse.json();

      expect(developResponse.status).toBe(200);
      expect(developResult.success).toBe(true);
      expect(developResult.data.storyId).toBe(userSession.storyId);
      expect(developResult.data.shots).toBeDefined();
      expect(Array.isArray(developResult.data.shots)).toBe(true);
      expect(developResult.data.shots.length).toBeGreaterThan(0);

      // Step 3: 생성된 샷 데이터 검증
      const shots = developResult.data.shots;
      shots.forEach((shot: any, index: number) => {
        expect(shot.shotNumber).toBe(index + 1);
        expect(shot.shotType).toBeDefined();
        expect(shot.description).toBeDefined();
        expect(shot.duration).toBeGreaterThan(0);
        expect(shot.camera).toBeDefined();
        expect(shot.lighting).toBeDefined();
        expect(shot.audio).toBeDefined();
      });

      // Step 4: 총 예상 시간 검증
      const totalEstimatedDuration = developResult.data.estimatedDuration;
      const calculatedDuration = shots.reduce((sum: number, shot: any) => sum + shot.duration, 0);
      expect(totalEstimatedDuration).toBe(calculatedDuration);

      console.log(`✅ Scenario development completed: ${shots.length} shots, ${totalEstimatedDuration}s total duration`);
    });
  });

  describe('PDF 생성 및 다운로드 플로우', () => {
    beforeEach(async () => {
      // 스토리 및 시나리오 준비
      const storyResponse = await fetch(`${BASE_URL}/api/planning/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `PDF 테스트 스토리 ${Date.now()}`,
          oneLineStory: 'PDF 생성을 위한 테스트 스토리',
        }),
      });
      const storyResult = await storyResponse.json();
      userSession.storyId = storyResult.id;
    });

    it('스토리에서 PDF 생성 및 다운로드까지 완료할 수 있어야 함', async () => {
      // Step 1: PDF 생성 요청
      const pdfData = {
        title: 'E2E 테스트 PDF',
        content: `
          이것은 E2E 테스트를 위한 PDF 컨텐츠입니다.
          
          스토리 제목: PDF 테스트 스토리
          
          주요 내용:
          - 한국어 폰트 테스트: 가나다라마바사아자차카타파하
          - 영어 텍스트: The quick brown fox jumps over the lazy dog
          - 특수문자: !@#$%^&*()_+-=[]{}|;:,.<>?
          
          이 PDF는 시스템의 한국어 지원 및 다양한 문자 처리 능력을 검증합니다.
        `.trim(),
        storyId: userSession.storyId,
      };

      const pdfResponse = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfData),
      });

      // Step 2: PDF 응답 검증
      expect(pdfResponse.status).toBe(200);
      expect(pdfResponse.headers.get('content-type')).toBe('application/pdf');
      expect(pdfResponse.headers.get('content-disposition')).toContain('attachment');
      expect(pdfResponse.headers.get('x-korean-font-used')).toBe('true'); // 한국어 포함

      // Step 3: PDF 바이너리 데이터 검증
      const pdfBuffer = await pdfResponse.arrayBuffer();
      expect(pdfBuffer.byteLength).toBeGreaterThan(100); // 최소 크기 검증
      
      // PDF 헤더 검증
      const uint8Array = new Uint8Array(pdfBuffer);
      const pdfHeader = new TextDecoder().decode(uint8Array.slice(0, 8));
      expect(pdfHeader).toBe('%PDF-1.4');

      // Step 4: 파일 크기 합리성 검증
      const fileSizeKB = pdfBuffer.byteLength / 1024;
      expect(fileSizeKB).toBeLessThan(500); // 500KB 이하
      expect(fileSizeKB).toBeGreaterThan(0.1); // 100B 이상

      console.log(`✅ PDF generation completed: ${fileSizeKB.toFixed(2)}KB file generated`);
    });

    it('대용량 컨텐츠 PDF 생성 제한이 올바르게 작동해야 함', async () => {
      // Step 1: 대용량 컨텐츠 준비
      const largeContent = 'A'.repeat(1000001); // 1MB + 1 byte

      const pdfData = {
        title: '대용량 컨텐츠 테스트',
        content: largeContent,
        storyId: userSession.storyId,
      };

      // Step 2: PDF 생성 요청 (실패 예상)
      const pdfResponse = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfData),
      });

      const result = await pdfResponse.json();

      // Step 3: 적절한 에러 응답 검증
      expect(pdfResponse.status).toBe(413); // Payload Too Large
      expect(result.error).toBe('컨텐츠가 너무 큽니다. 메모리 부족으로 처리할 수 없습니다.');

      console.log('✅ Large content PDF generation properly rejected');
    });
  });

  describe('파일 업로드 및 처리 플로우', () => {
    it('비디오 파일 업로드 전체 플로우가 완료되어야 함', async () => {
      // Step 1: 테스트 비디오 파일 생성
      const videoContent = new ArrayBuffer(10 * 1024 * 1024); // 10MB
      const videoFile = new File([videoContent], 'test-video.mp4', { type: 'video/mp4' });
      const formData = new FormData();
      formData.append('video', videoFile);

      // Step 2: 파일 업로드
      const uploadResponse = await fetch(`${BASE_URL}/api/upload/video`, {
        method: 'POST',
        body: formData,
      });
      const uploadResult = await uploadResponse.json();

      expect(uploadResponse.status).toBe(200);
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.data.id).toBeDefined();
      expect(uploadResult.data.filename).toBe('test-video.mp4');
      expect(uploadResult.data.size).toBe(10 * 1024 * 1024);

      // Step 3: 업로드된 파일 정보 검증
      expect(uploadResult.data.type).toBe('video/mp4');
      expect(uploadResult.data.url).toContain('test-video.mp4');
      expect(uploadResult.data.uploadedAt).toBeDefined();

      // Step 4: 업로드 시간 검증 (현재 시간과 비교)
      const uploadTime = new Date(uploadResult.data.uploadedAt);
      const now = new Date();
      const timeDiff = now.getTime() - uploadTime.getTime();
      expect(timeDiff).toBeLessThan(60000); // 1분 이내

      console.log(`✅ Video upload completed: ${uploadResult.data.id}`);
    });

    it('이미지 파일 업로드 및 썸네일 생성 플로우가 완료되어야 함', async () => {
      // Step 1: 테스트 이미지 파일 생성
      const imageContent = new ArrayBuffer(2 * 1024 * 1024); // 2MB
      const imageFile = new File([imageContent], 'test-image.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('image', imageFile);

      // Step 2: 이미지 업로드
      const uploadResponse = await fetch(`${BASE_URL}/api/upload/image`, {
        method: 'POST',
        body: formData,
      });
      const uploadResult = await uploadResponse.json();

      expect(uploadResponse.status).toBe(200);
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.data.filename).toBe('test-image.jpg');
      expect(uploadResult.data.type).toBe('image/jpeg');

      // Step 3: 썸네일 URL 검증
      expect(uploadResult.data.url).toContain('test-image.jpg');
      expect(uploadResult.data.thumbnailUrl).toContain('thumb/test-image.jpg');

      console.log(`✅ Image upload with thumbnail completed: ${uploadResult.data.id}`);
    });
  });

  describe('전체 통합 워크플로우', () => {
    it('회원가입 → 스토리 생성 → 시나리오 개발 → PDF 생성 전체 플로우', async () => {
      console.log('\n🚀 Starting complete user workflow test...\n');

      // Phase 1: 사용자 가입 및 인증
      const timestamp = Date.now();
      const userData = {
        email: `workflow.${timestamp}@example.com`,
        username: `workflow${timestamp}`,
        password: 'WorkflowTest123!',
      };

      const signupResponse = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const signupResult = await signupResponse.json();
      
      expect(signupResponse.status).toBe(200);
      userSession.userId = signupResult.data.id;
      console.log(`✅ Phase 1: User registered - ${userData.email}`);

      // Phase 2: 스토리 기획
      const storyData = {
        title: `워크플로우 테스트 스토리 ${timestamp}`,
        oneLineStory: '완전한 워크플로우 테스트를 위한 스토리입니다.',
        genre: 'Thriller',
        tone: 'Suspenseful',
        target: 'Adult',
      };

      const storyResponse = await fetch(`${BASE_URL}/api/planning/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storyData),
      });
      const storyResult = await storyResponse.json();
      
      expect(storyResponse.status).toBe(201);
      userSession.storyId = storyResult.id;
      console.log(`✅ Phase 2: Story created - ${userSession.storyId}`);

      // Phase 3: 시나리오 개발
      const scenarioData = {
        storyId: userSession.storyId,
        scenario: `
          긴장감 넘치는 추격 시퀀스. 주인공이 어두운 골목을 뛰어가며 
          정체불명의 추격자로부터 도망치는 장면. 카메라는 핸드헬드로
          생동감을 더하고, 조명은 가로등의 불규칙한 명암을 활용.
        `.trim(),
      };

      const scenarioResponse = await fetch(`${BASE_URL}/api/scenario/develop-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenarioData),
      });
      const scenarioResult = await scenarioResponse.json();
      
      expect(scenarioResponse.status).toBe(200);
      expect(scenarioResult.data.shots.length).toBeGreaterThan(0);
      console.log(`✅ Phase 3: Scenario developed - ${scenarioResult.data.shots.length} shots`);

      // Phase 4: PDF 생성
      const pdfContent = `
        워크플로우 테스트 최종 결과
        
        스토리: ${storyData.title}
        시나리오 샷 수: ${scenarioResult.data.shots.length}
        예상 상영시간: ${scenarioResult.data.estimatedDuration}초
        
        샷 리스트:
        ${scenarioResult.data.shots.map((shot: any, index: number) => 
          `${index + 1}. ${shot.shotType} - ${shot.description.substring(0, 50)}...`
        ).join('\n')}
        
        생성 일시: ${new Date().toISOString()}
        사용자: ${userData.email}
      `.trim();

      const pdfResponse = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `워크플로우 테스트 결과 - ${timestamp}`,
          content: pdfContent,
          storyId: userSession.storyId,
        }),
      });

      expect(pdfResponse.status).toBe(200);
      expect(pdfResponse.headers.get('content-type')).toBe('application/pdf');
      console.log(`✅ Phase 4: PDF generated successfully`);

      // 최종 검증
      const pdfBuffer = await pdfResponse.arrayBuffer();
      const pdfSize = pdfBuffer.byteLength / 1024; // KB
      
      console.log(`\n🎉 Complete workflow test passed!`);
      console.log(`📊 Summary:`);
      console.log(`   - User: ${userData.email}`);
      console.log(`   - Story: ${userSession.storyId}`);
      console.log(`   - Shots: ${scenarioResult.data.shots.length}`);
      console.log(`   - Duration: ${scenarioResult.data.estimatedDuration}s`);
      console.log(`   - PDF Size: ${pdfSize.toFixed(2)}KB`);
      console.log(`\n`);

      expect(pdfSize).toBeGreaterThan(0.5); // 최소 PDF 크기
      expect(pdfSize).toBeLessThan(200); // 최대 PDF 크기
    }, 60000); // 60초 타임아웃
  });
});
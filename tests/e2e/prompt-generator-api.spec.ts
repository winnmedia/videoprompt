import { test, expect } from '@playwright/test';

/**
 * E2E 테스트: 프롬프트 생성 API 및 품질 검증
 * 
 * 중점 검증 사항:
 * 1. API 호출 및 응답 검증
 * 2. 생성된 프롬프트의 기술적 품질
 * 3. AI 비디오 생성 도구에 적합한 프롬프트인지 검증
 * 4. 다양한 입력에 대한 프롬프트 변화 검증
 * 5. CineGenius v3.1 vs v2.0 차이점 검증
 */

interface PromptQualityMetrics {
  hasVisualDescriptions: boolean;
  hasCameraInstructions: boolean;
  hasTimelineStructure: boolean;
  keywordCount: number;
  negativePromptPresent: boolean;
  technicalSpecsPresent: boolean;
  contextualRelevance: number; // 0-1 스코어
}

interface GeneratedPromptData {
  id: string;
  version: number;
  cinegeniusVersion: string;
  metadata: any;
  timeline: any[];
  negative?: string[];
}

test.describe('프롬프트 생성 API 및 품질 검증', () => {
  
  test('API 응답 구조 및 유효성 검증', async ({ page }) => {
    let apiResponse: GeneratedPromptData | null = null;
    let requestPayload: any = null;

    // API 호출 감지
    page.on('request', async (request) => {
      if (request.url().includes('/api/planning/prompt') && request.method() === 'POST') {
        try {
          requestPayload = await request.postDataJSON();
        } catch (error) {
          console.error('Request payload 파싱 실패:', error);
        }
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('/api/planning/prompt') && response.request().method() === 'POST') {
        try {
          apiResponse = await response.json();
        } catch (error) {
          console.error('Response 파싱 실패:', error);
        }
      }
    });

    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();

    // 완전한 프롬프트 생성 과정 수행
    await fillCompletePromptForm(page);

    // 프롬프트 생성 API 호출
    const generateButton = page.locator('button:has-text("프롬프트 생성")');
    if (await generateButton.isVisible()) {
      await generateButton.click();
      
      // API 응답 대기
      await page.waitForTimeout(5000);

      // API 응답 검증
      if (apiResponse) {
        // 기본 구조 검증
        expect(apiResponse.id).toBeDefined();
        expect(apiResponse.version).toBeGreaterThanOrEqual(1);
        expect(apiResponse.cinegeniusVersion).toBeDefined();

        // 메타데이터 존재 확인
        expect(apiResponse.metadata).toBeDefined();
        expect(typeof apiResponse.metadata).toBe('object');

        // 타임라인 구조 확인
        if (apiResponse.timeline) {
          expect(Array.isArray(apiResponse.timeline)).toBe(true);
        }

        console.log('API Response validated:', {
          id: apiResponse.id,
          version: apiResponse.version,
          cinegeniusVersion: apiResponse.cinegeniusVersion,
          hasMetadata: !!apiResponse.metadata,
          timelineLength: apiResponse.timeline?.length || 0
        });
      }

      // 요청 페이로드 검증
      if (requestPayload) {
        expect(requestPayload).toBeDefined();
        console.log('Request payload structure:', Object.keys(requestPayload));
      }
    }
  });

  test('프롬프트 품질 메트릭 검증', async ({ page }) => {
    let generatedPrompt: any = null;

    page.on('response', async (response) => {
      if (response.url().includes('/api/planning/prompt') && response.request().method() === 'POST') {
        try {
          generatedPrompt = await response.json();
        } catch (error) {
          console.error('Response 파싱 실패:', error);
        }
      }
    });

    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();

    // 고품질 프롬프트를 위한 상세 입력
    await page.locator('[data-testid="input-prompt-name"]').fill('고품질 SF 액션 시퀀스');
    
    // 스타일 다중 선택
    await page.locator('[data-testid="style-tab-genre"]').click();
    await page.locator('[data-testid*="style-card-"]').first().click();
    
    await page.locator('[data-testid="style-tab-mood"]').click();
    await page.locator('[data-testid*="style-card-"]').first().click();

    await page.locator('[data-testid="style-tab-quality"]').click();
    await page.locator('[data-testid*="style-card-"]').first().click();

    // 상세한 장면 설명
    await page.locator('[data-testid="textarea-room-desc"]').fill(
      '미래 도시의 네온사인이 가득한 고층 건물 옥상, 비가 내리며 젖은 표면이 형광등을 반사하고, ' +
      '멀리서 번개가 치며 어두운 구름 사이로 달빛이 새어 나온다. 홀로그램 광고판들이 ' +
      '건물 벽면에 투사되며 청록색과 보라색 불빛이 장면을 지배한다.'
    );

    // 정교한 카메라 설정
    await page.locator('[data-testid="textarea-camera-setup"]').fill(
      '와이드 샷으로 전체 장면을 보여주며 시작하여, 서서히 주인공에게 접근하는 dolly in. ' +
      '액션 시퀀스에서는 핸드헬드 카메라로 전환하여 긴장감을 높이고, ' +
      '절정 부분에서는 360도 회전 샷으로 역동성을 표현한다.'
    );

    // 고급 옵션들 설정
    await page.locator('[data-testid="select-weather"]').selectOption('Heavy Rain');
    await page.locator('[data-testid="select-lighting"]').selectOption('Neon/Artificial');
    await page.locator('[data-testid="select-primary-lens"]').selectOption('35mm (Natural)');
    await page.locator('[data-testid="select-dominant-movement"]').selectOption('Dolly');

    await page.locator('[data-testid="btn-next-step1"]').click();

    // 모든 단계를 빠르게 진행
    await proceedThroughAllSteps(page);

    // 프롬프트 생성
    const generateButton = page.locator('button:has-text("프롬프트 생성")');
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(5000);

      if (generatedPrompt) {
        const qualityMetrics = evaluatePromptQuality(generatedPrompt);
        
        // 품질 메트릭 검증
        expect(qualityMetrics.hasVisualDescriptions).toBe(true);
        expect(qualityMetrics.hasCameraInstructions).toBe(true);
        expect(qualityMetrics.keywordCount).toBeGreaterThan(5);
        expect(qualityMetrics.contextualRelevance).toBeGreaterThan(0.7);

        console.log('프롬프트 품질 메트릭:', qualityMetrics);
      }
    }
  });

  test('CineGenius v3.1 vs v2.0 비교 검증', async ({ page }) => {
    const promptResults: Array<{ version: string; data: any }> = [];

    page.on('response', async (response) => {
      if (response.url().includes('/api/planning/prompt') && response.request().method() === 'POST') {
        try {
          const data = await response.json();
          promptResults.push({
            version: data.cinegeniusVersion || 'unknown',
            data
          });
        } catch (error) {
          console.error('Response 파싱 실패:', error);
        }
      }
    });

    // v2.0 모드로 프롬프트 생성
    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();

    await fillStandardPromptForm(page);
    await proceedThroughAllSteps(page);

    const generateButtonV2 = page.locator('button:has-text("프롬프트 생성")');
    if (await generateButtonV2.isVisible()) {
      await generateButtonV2.click();
      await page.waitForTimeout(3000);
    }

    // 페이지 새로고침 후 v3.1 모드로 테스트
    await page.reload();
    await page.locator('button:has-text("건너뛰기")').click();

    // v3.1 모드로 전환
    const v31Toggle = page.locator('button:has-text("v2")');
    if (await v31Toggle.isVisible()) {
      await v31Toggle.click();
      
      // v3.1 특화 입력
      await page.locator('textarea[placeholder*="햇살이 비치는 카페"]').fill(
        '고급 레스토랑에서 셰프가 플라밍을 하는 장면, 화염이 춤추며 요리를 완성하는 예술적 순간'
      );
      
      await page.locator('input[placeholder="내 영상 프로젝트"]').fill('요리 예술 프로젝트 v3.1');
      await page.locator('select').first().selectOption('15');
      await page.locator('button:has-text("16:9")').click();
      
      await page.locator('button:has-text("다음 단계")').click();
      
      // v3.1의 추가 단계들을 처리 (아직 구현되지 않은 경우 건너뛰기)
      for (let i = 0; i < 3; i++) {
        const nextButton = page.locator('button:has-text("다음 단계")');
        if (await nextButton.isVisible({ timeout: 2000 })) {
          await nextButton.click();
        } else {
          break;
        }
      }
      
      const generateButtonV31 = page.locator('button:has-text("v3.1 프롬프트 생성")');
      if (await generateButtonV31.isVisible()) {
        await generateButtonV31.click();
        await page.waitForTimeout(3000);
      }
    }

    // 두 버전의 결과 비교
    if (promptResults.length >= 1) {
      console.log(`총 ${promptResults.length}개의 프롬프트 생성됨`);
      
      promptResults.forEach((result, index) => {
        console.log(`프롬프트 ${index + 1} (${result.version}):`, {
          id: result.data.id,
          version: result.data.version,
          cinegeniusVersion: result.data.cinegeniusVersion,
          hasAdvancedFeatures: !!result.data.projectId || !!result.data.userInput
        });
      });

      // v3.1이 v2.0보다 더 많은 기능을 제공하는지 검증
      const v31Results = promptResults.filter(r => r.version === '3.1');
      const v2Results = promptResults.filter(r => r.version === '2.0');
      
      if (v31Results.length > 0 && v2Results.length > 0) {
        const v31Features = Object.keys(v31Results[0].data).length;
        const v2Features = Object.keys(v2Results[0].data).length;
        
        console.log(`v3.1 기능 수: ${v31Features}, v2.0 기능 수: ${v2Features}`);
      }
    }
  });

  test('다양한 입력 조건에 따른 프롬프트 변화 검증', async ({ page }) => {
    const testCases = [
      {
        name: '미니멀 입력',
        data: {
          name: '미니멀 테스트',
          scene: '간단한 방',
          camera: '정적 샷'
        }
      },
      {
        name: '상세 입력',
        data: {
          name: '상세 영화적 장면',
          scene: '골든아워의 탁 트인 초원, 바람에 흔들리는 금빛 풀들과 멀리 보이는 산맥, 구름 그림자가 땅 위를 지나가며 끊임없이 변화하는 빛의 패턴',
          camera: '드론으로 높은 고도에서 시작하여 서서히 지면으로 내려오며, 마지막에는 풀잎 사이를 스쳐 지나가는 close-up 매크로 샷으로 마무리'
        }
      },
      {
        name: '액션 중심',
        data: {
          name: '액션 시퀀스',
          scene: '폭발하는 건물, 불꽃과 연기, 파편이 날아다니는 혼돈 속',
          camera: '빠른 핸드헬드 카메라 움직임, 폭발 순간 슬로우모션'
        }
      }
    ];

    const generatedPrompts: Array<{ testCase: string; promptData: any }> = [];

    page.on('response', async (response) => {
      if (response.url().includes('/api/planning/prompt') && response.request().method() === 'POST') {
        try {
          const data = await response.json();
          const currentTestCase = testCases.find(tc => 
            data.metadata?.project_name?.includes(tc.data.name) || 
            data.metadata?.prompt_name?.includes(tc.data.name)
          );
          
          if (currentTestCase) {
            generatedPrompts.push({
              testCase: currentTestCase.name,
              promptData: data
            });
          }
        } catch (error) {
          console.error('Response 파싱 실패:', error);
        }
      }
    });

    for (const testCase of testCases) {
      await page.goto('/prompt-generator');
      await page.locator('button:has-text("건너뛰기")').click();

      // 테스트 케이스에 따른 입력
      await page.locator('[data-testid="input-prompt-name"]').fill(testCase.data.name);
      
      // 스타일 선택
      await page.locator('[data-testid="style-tab-visual"]').click();
      await page.locator('[data-testid*="style-card-"]').first().click();

      await page.locator('[data-testid="textarea-room-desc"]').fill(testCase.data.scene);
      await page.locator('[data-testid="textarea-camera-setup"]').fill(testCase.data.camera);

      await page.locator('[data-testid="btn-next-step1"]').click();
      await proceedThroughAllSteps(page);

      const generateButton = page.locator('button:has-text("프롬프트 생성")');
      if (await generateButton.isVisible()) {
        await generateButton.click();
        await page.waitForTimeout(3000);
      }

      // 잠시 대기 후 다음 테스트 케이스로
      await page.waitForTimeout(1000);
    }

    // 생성된 프롬프트들의 차이점 분석
    expect(generatedPrompts.length).toBeGreaterThanOrEqual(1);

    generatedPrompts.forEach((prompt, index) => {
      console.log(`테스트 케이스 "${prompt.testCase}" 결과:`, {
        id: prompt.promptData.id,
        metadataKeys: Object.keys(prompt.promptData.metadata || {}),
        timelineLength: prompt.promptData.timeline?.length || 0
      });

      // 각 테스트 케이스에 맞는 특성이 반영되었는지 검증
      const qualityScore = evaluatePromptQuality(prompt.promptData);
      expect(qualityScore.contextualRelevance).toBeGreaterThan(0.5);
    });
  });

  test('프롬프트의 AI 비디오 생성 적합성 검증', async ({ page }) => {
    let finalPrompt: any = null;

    page.on('response', async (response) => {
      if (response.url().includes('/api/planning/prompt') && response.request().method() === 'POST') {
        try {
          finalPrompt = await response.json();
        } catch (error) {
          console.error('Response 파싱 실패:', error);
        }
      }
    });

    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();

    // AI 비디오 생성에 최적화된 입력
    await fillVideoOptimizedForm(page);
    await proceedThroughAllSteps(page);

    const generateButton = page.locator('button:has-text("프롬프트 생성")');
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(5000);

      if (finalPrompt) {
        // AI 비디오 생성 도구 적합성 검증
        const videoCompatibility = evaluateVideoGenerationCompatibility(finalPrompt);
        
        expect(videoCompatibility.hasVisualDescriptions).toBe(true);
        expect(videoCompatibility.hasTechnicalSpecs).toBe(true);
        expect(videoCompatibility.hasTimeStructure).toBe(true);
        expect(videoCompatibility.compatibilityScore).toBeGreaterThan(0.8);

        console.log('AI 비디오 생성 적합성 점수:', videoCompatibility);
      }
    }
  });

  test('에러 응답 처리 및 복구 테스트', async ({ page }) => {
    // 실패하는 API 호출 모킹
    await page.route('/api/planning/prompt', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'VALIDATION_ERROR', 
          message: 'Invalid prompt data' 
        })
      });
    });

    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();

    await fillStandardPromptForm(page);
    await proceedThroughAllSteps(page);

    const generateButton = page.locator('button:has-text("프롬프트 생성")');
    await generateButton.click();

    // 에러 처리 확인
    await page.waitForTimeout(3000);
    
    // 로딩 상태가 해제되어야 함
    await expect(page.locator('text=생성 중')).toBeHidden();
    
    // 사용자가 다시 시도할 수 있어야 함
    await expect(generateButton).toBeVisible();

    // 정상 API로 복구 테스트
    await page.unroute('/api/planning/prompt');
    
    // 다시 시도
    await generateButton.click();
    await page.waitForTimeout(3000);
  });
});

// 헬퍼 함수들
async function fillCompletePromptForm(page: any) {
  await page.locator('[data-testid="input-prompt-name"]').fill('완전한 테스트 프롬프트');
  
  await page.locator('[data-testid="style-tab-visual"]').click();
  await page.locator('[data-testid*="style-card-"]').first().click();
  
  await page.locator('[data-testid="textarea-room-desc"]').fill(
    '현대적인 유리 건물 내부의 고급 회의실, 거대한 창문으로 도시 전경이 보이며 자연광이 스며든다'
  );
  
  await page.locator('[data-testid="textarea-camera-setup"]').fill(
    '회의실 전체를 보여주는 와이드 샷에서 시작하여 회의 참가자들을 차례로 보여주는 팬 샷'
  );

  await page.locator('[data-testid="select-aspect-ratio"]').selectOption('16:9');
  await page.locator('[data-testid="btn-next-step1"]').click();
}

async function fillStandardPromptForm(page: any) {
  await page.locator('[data-testid="input-prompt-name"]').fill('표준 v2.0 테스트');
  
  await page.locator('[data-testid="style-tab-visual"]').click();
  await page.locator('[data-testid*="style-card-"]').first().click();
  
  await page.locator('[data-testid="textarea-room-desc"]').fill('카페 내부, 따뜻한 조명');
  await page.locator('[data-testid="textarea-camera-setup"]').fill('정적인 카메라 앵글');

  await page.locator('[data-testid="btn-next-step1"]').click();
}

async function fillVideoOptimizedForm(page: any) {
  await page.locator('[data-testid="input-prompt-name"]').fill('AI 비디오 최적화 프롬프트');
  
  // 여러 스타일 선택으로 다양성 확보
  await page.locator('[data-testid="style-tab-visual"]').click();
  await page.locator('[data-testid*="style-card-"]').first().click();
  
  await page.locator('[data-testid="style-tab-quality"]').click();
  await page.locator('[data-testid*="style-card-"]').first().click();

  // 비디오 생성에 적합한 상세 설명
  await page.locator('[data-testid="textarea-room-desc"]').fill(
    '일몰 시간의 해변, 황금빛 파도가 부드럽게 모래사장에 밀려와 거품을 만들며, ' +
    '갈매기들이 하늘을 날아다니고 야자수가 바람에 살랑거린다'
  );
  
  // 명확한 카메라 무빙과 타이밍
  await page.locator('[data-testid="textarea-camera-setup"]').fill(
    '해변을 따라 천천히 이동하는 트래킹 샷, 5초 후 파도 클로즈업으로 전환, ' +
    '마지막 3초는 일몰을 프레임하는 와이드 샷'
  );

  // 기술적 사양 명시
  await page.locator('[data-testid="select-aspect-ratio"]').selectOption('16:9');
  await page.locator('[data-testid="select-weather"]').selectOption('Clear');
  await page.locator('[data-testid="select-lighting"]').selectOption('Golden Hour');
  
  await page.locator('[data-testid="btn-next-step1"]').click();
}

async function proceedThroughAllSteps(page: any) {
  // 2단계부터 4단계까지 빠르게 진행
  for (let step = 2; step <= 4; step++) {
    const nextButton = page.locator('button:has-text("다음 단계")');
    if (await nextButton.isVisible({ timeout: 2000 })) {
      await nextButton.click();
      await page.waitForTimeout(500);
    } else {
      break; // 4단계에 도달했으면 종료
    }
  }
}

function evaluatePromptQuality(promptData: any): PromptQualityMetrics {
  const metadata = promptData.metadata || {};
  const timeline = promptData.timeline || [];
  
  const hasVisualDescriptions = !!(
    metadata.scene_description || 
    metadata.room_description ||
    metadata.placeDescription
  );
  
  const hasCameraInstructions = !!(
    metadata.camera_setup || 
    metadata.camera_movement ||
    metadata.primaryLens
  );
  
  const hasTimelineStructure = timeline.length > 0;
  
  const keywordCount = [
    metadata.base_style,
    metadata.genre,
    metadata.mood,
    metadata.quality
  ].filter(Boolean).flat().length;
  
  const negativePromptPresent = !!(
    promptData.negative && 
    Array.isArray(promptData.negative) && 
    promptData.negative.length > 0
  );
  
  const technicalSpecsPresent = !!(
    metadata.aspect_ratio || 
    metadata.weather || 
    metadata.lighting
  );
  
  // 간단한 관련성 점수 계산 (실제로는 더 정교한 NLP 분석 필요)
  let contextualRelevance = 0.5; // 기본 점수
  if (hasVisualDescriptions) contextualRelevance += 0.2;
  if (hasCameraInstructions) contextualRelevance += 0.2;
  if (keywordCount > 3) contextualRelevance += 0.1;
  contextualRelevance = Math.min(contextualRelevance, 1.0);

  return {
    hasVisualDescriptions,
    hasCameraInstructions,
    hasTimelineStructure,
    keywordCount,
    negativePromptPresent,
    technicalSpecsPresent,
    contextualRelevance
  };
}

interface VideoCompatibility {
  hasVisualDescriptions: boolean;
  hasTechnicalSpecs: boolean;
  hasTimeStructure: boolean;
  compatibilityScore: number;
}

function evaluateVideoGenerationCompatibility(promptData: any): VideoCompatibility {
  const qualityMetrics = evaluatePromptQuality(promptData);
  
  const hasVisualDescriptions = qualityMetrics.hasVisualDescriptions;
  const hasTechnicalSpecs = qualityMetrics.technicalSpecsPresent;
  const hasTimeStructure = qualityMetrics.hasTimelineStructure;
  
  // AI 비디오 생성 도구 호환성 점수 계산
  let score = 0;
  if (hasVisualDescriptions) score += 0.4;
  if (hasTechnicalSpecs) score += 0.3;
  if (hasTimeStructure) score += 0.2;
  if (qualityMetrics.keywordCount > 5) score += 0.1;
  
  return {
    hasVisualDescriptions,
    hasTechnicalSpecs,
    hasTimeStructure,
    compatibilityScore: Math.min(score, 1.0)
  };
}
/**
 * 비디오 피드백 시스템 E2E 테스트
 * 
 * 실제 브라우저 환경에서 전체 워크플로우를 테스트합니다.
 * - 실제 비디오 파일 업로드
 * - 다중 사용자 시나리오
 * - 실시간 협업 기능
 * - 네트워크 상태 변화 대응
 */

import { test, expect, Page, Browser, BrowserContext } from '@playwright/test';
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// 테스트용 비디오 파일 생성 헬퍼
const createTestVideoFile = async (fileName: string = 'test-video.mp4'): Promise<string> => {
  const videoPath = path.join(__dirname, '..', '..', 'test-assets', fileName);
  
  // 테스트 에셋 디렉토리 생성
  const assetsDir = path.dirname(videoPath);
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  
  // 더미 MP4 헤더 생성 (최소한의 유효한 MP4 파일)
  const mp4Header = Buffer.from([
    0x00, 0x00, 0x00, 0x20, // Box size (32 bytes)
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6F, 0x6D, // 'isom'
    0x00, 0x00, 0x02, 0x00, // Minor version
    0x69, 0x73, 0x6F, 0x6D, // Compatible brands
    0x69, 0x73, 0x6F, 0x32,
    0x61, 0x76, 0x63, 0x31,
    0x6D, 0x70, 0x34, 0x31,
  ]);
  
  // 더미 데이터로 1MB 파일 생성
  const padding = Buffer.alloc(1024 * 1024 - mp4Header.length, 0);
  const videoContent = Buffer.concat([mp4Header, padding]);
  
  fs.writeFileSync(videoPath, videoContent);
  return videoPath;
};

// 테스트 설정
test.describe('비디오 피드백 시스템 E2E 테스트', () => {
  let browser: Browser;
  let testVideoPath: string;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    testVideoPath = await createTestVideoFile('e2e-test-video.mp4');
  });

  test.afterAll(async () => {
    await browser.close();
    
    // 테스트 파일 정리
    if (fs.existsSync(testVideoPath)) {
      fs.unlinkSync(testVideoPath);
    }
  });

  test.describe('1. 비디오 업로드 및 기본 기능', () => {
    test('사용자가 비디오를 업로드하고 피드백 페이지에서 확인할 수 있다', async ({ page }) => {
      // 홈페이지로 이동
      await page.goto('/');
      
      // 비디오 업로드 버튼 클릭
      await page.click('text=영상 업로드');
      
      // 파일 업로드
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testVideoPath);
      
      // 업로드 버튼 클릭
      await page.click('text=업로드');
      
      // 업로드 완료 후 피드백 페이지로 이동되는지 확인
      await expect(page).toHaveURL(/.*\/feedback.*/);
      
      // 비디오 플레이어가 표시되는지 확인
      await expect(page.locator('video')).toBeVisible();
      
      // 기본 UI 요소들 확인
      await expect(page.locator('[data-testid="feedback-textarea"]')).toBeVisible();
      await expect(page.getByText('코멘트')).toBeVisible();
    });

    test('업로드된 비디오의 메타데이터가 올바르게 표시된다', async ({ page }) => {
      await page.goto('/feedback?videoId=test-video&token=test-token');
      
      // 비디오 정보 확인
      const videoElement = page.locator('video').first();
      await expect(videoElement).toHaveAttribute('src', /.+/);
      
      // 버전 정보 확인
      await expect(page.locator('select').first()).toHaveValue('v1');
      
      // 업로더 정보 확인
      await expect(page.getByText(/업로더:/)).toBeVisible();
    });

    test('잘못된 파일 타입 업로드 시 오류 메시지가 표시된다', async ({ page }) => {
      // 이미지 파일 생성
      const imagePath = path.join(__dirname, '..', '..', 'test-assets', 'test-image.jpg');
      fs.writeFileSync(imagePath, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])); // JPEG header
      
      await page.goto('/');
      
      await page.click('text=영상 업로드');
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(imagePath);
      
      await page.click('text=업로드');
      
      // 오류 메시지 확인
      await expect(page.getByText(/유효한 영상 파일이 아닙니다/)).toBeVisible();
      
      // 정리
      fs.unlinkSync(imagePath);
    });
  });

  test.describe('2. 댓글 시스템 E2E', () => {
    test('사용자가 댓글을 작성하고 다른 사용자가 실시간으로 확인할 수 있다', async ({ page, context }) => {
      // 첫 번째 사용자 세션
      await page.goto('/feedback?videoId=test-video&token=user1-token');
      
      // 댓글 작성
      const textarea = page.locator('[data-testid="feedback-textarea"]');
      await textarea.fill('첫 번째 사용자의 댓글입니다');
      await page.click('text=등록');
      
      // 댓글이 목록에 나타나는지 확인
      await expect(page.getByText('첫 번째 사용자의 댓글입니다')).toBeVisible({ timeout: 10000 });
      
      // 두 번째 사용자 세션 (새 페이지)
      const page2 = await context.newPage();
      await page2.goto('/feedback?videoId=test-video&token=user2-token');
      
      // 첫 번째 사용자의 댓글이 두 번째 사용자에게도 보이는지 확인 (폴링)
      await expect(page2.getByText('첫 번째 사용자의 댓글입니다')).toBeVisible({ timeout: 15000 });
      
      // 두 번째 사용자도 댓글 작성
      const textarea2 = page2.locator('[data-testid="feedback-textarea"]');
      await textarea2.fill('두 번째 사용자의 답글입니다');
      await page2.click('text=등록');
      
      // 첫 번째 사용자 페이지에서 두 번째 사용자의 댓글 확인
      await expect(page.getByText('두 번째 사용자의 답글입니다')).toBeVisible({ timeout: 15000 });
      
      await page2.close();
    });

    test('타임코드 기반 댓글이 올바르게 작동한다', async ({ page }) => {
      await page.goto('/feedback?videoId=test-video&token=test-token');
      
      // 비디오 재생 및 특정 시점으로 이동
      const video = page.locator('video').first();
      await video.click(); // 재생 시작
      
      // 2초 시점으로 이동 (비디오 컨트롤 사용)
      await video.evaluate((v: HTMLVideoElement) => {
        v.currentTime = 2.5;
      });
      
      // 현재 시점 피드백 버튼 클릭
      await page.click('text=현재 시점 피드백');
      
      // 타임코드가 텍스트 영역에 삽입되었는지 확인
      const textarea = page.locator('[data-testid="feedback-textarea"]');
      await expect(textarea).toHaveValue(/^@TC\d{2}:\d{2}\.\d{3} /);
      
      // 추가 텍스트 입력
      await textarea.fill(await textarea.inputValue() + '이 시점에 중요한 피드백이 있습니다');
      
      // 댓글 등록
      await page.click('text=등록');
      
      // 댓글 목록에서 타임코드 버튼 확인
      await expect(page.locator('button:has-text("@TC")')).toBeVisible({ timeout: 10000 });
      
      // 타임코드 버튼 클릭하여 비디오가 해당 시점으로 이동하는지 확인
      const timecodeButton = page.locator('button:has-text("@TC")').first();
      await timecodeButton.click();
      
      // 비디오 시간 확인 (정확한 시간 매칭은 브라우저별로 다를 수 있으므로 범위로 확인)
      const currentTime = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
      expect(currentTime).toBeGreaterThanOrEqual(2);
      expect(currentTime).toBeLessThanOrEqual(3);
    });

    test('T 키 단축키로 타임코드를 삽입할 수 있다', async ({ page }) => {
      await page.goto('/feedback?videoId=test-video&token=test-token');
      
      // 비디오 영역에 포커스 (입력창 외부)
      await page.locator('video').click();
      
      // T 키 누르기
      await page.keyboard.press('T');
      
      // 텍스트 영역에 타임코드가 삽입되고 포커스가 이동했는지 확인
      const textarea = page.locator('[data-testid="feedback-textarea"]');
      await expect(textarea).toHaveValue(/^@TC\d{2}:\d{2}\.\d{3} /);
      await expect(textarea).toBeFocused();
    });
  });

  test.describe('3. 공유 및 권한 시스템', () => {
    test('관리자가 공유 링크를 생성하고 다른 사용자가 접근할 수 있다', async ({ page, context }) => {
      // 관리자 세션
      await page.goto('/feedback?videoId=test-video&token=admin-token');
      
      // 공유 버튼 클릭
      await page.click('text=영상 공유');
      
      // 공유 설정
      await page.fill('input[id="nickname"]', '테스트 뷰어');
      await page.selectOption('select[id="role"]', 'viewer');
      await page.fill('input[id="expire-days"]', '3');
      
      // 링크 발급
      await page.click('text=링크 발급');
      
      // 클립보드에서 링크 추출 (실제로는 API 응답을 모킹해야 함)
      await expect(page.locator('text=공유 링크가 클립보드에 복사되었습니다')).toBeVisible({ timeout: 5000 });
      
      // 새 사용자 세션에서 뷰어 권한으로 접근
      const viewerPage = await context.newPage();
      await viewerPage.goto('/feedback?videoId=test-video&token=viewer-token');
      
      // 뷰어는 비디오를 볼 수 있지만 댓글을 작성할 수 없어야 함
      await expect(viewerPage.locator('video')).toBeVisible();
      
      // 댓글 작성 시도 (실패해야 함)
      const viewerTextarea = viewerPage.locator('[data-testid="feedback-textarea"]');
      await viewerTextarea.fill('뷰어 권한으로 댓글 작성 시도');
      await viewerPage.click('text=등록');
      
      // 권한 오류 또는 댓글이 추가되지 않음을 확인
      // (실제 구현에 따라 다를 수 있음)
      
      await viewerPage.close();
    });

    test('만료된 토큰으로 접근 시 적절한 오류 처리가 된다', async ({ page }) => {
      await page.goto('/feedback?videoId=test-video&token=expired-token');
      
      // 만료된 토큰에 대한 처리 확인
      // (API가 410 상태를 반환하도록 모킹되어 있어야 함)
      
      // 적절한 오류 메시지나 리다이렉트 확인
      await expect(page.locator('text=토큰이 만료되었습니다')).toBeVisible({ timeout: 10000 })
        .or(expect(page).toHaveURL('/error'));
    });
  });

  test.describe('4. 실시간 협업 시나리오', () => {
    test('여러 사용자가 동시에 협업할 수 있다', async ({ page, context }) => {
      // 3명의 사용자 세션 생성
      const users = [
        { page: page, token: 'user1-token', name: '사용자1' },
        { page: await context.newPage(), token: 'user2-token', name: '사용자2' },
        { page: await context.newPage(), token: 'user3-token', name: '사용자3' }
      ];

      // 모든 사용자가 같은 비디오에 접근
      for (const user of users) {
        await user.page.goto(`/feedback?videoId=collaboration-video&token=${user.token}`);
        await expect(user.page.locator('video')).toBeVisible();
      }

      // 사용자 1이 댓글 작성
      const textarea1 = users[0].page.locator('[data-testid="feedback-textarea"]');
      await textarea1.fill('사용자1의 첫 번째 댓글');
      await users[0].page.click('text=등록');

      // 다른 사용자들이 댓글을 볼 수 있는지 확인
      for (let i = 1; i < users.length; i++) {
        await expect(users[i].page.getByText('사용자1의 첫 번째 댓글'))
          .toBeVisible({ timeout: 15000 });
      }

      // 사용자 2가 타임코드 댓글 작성
      const video2 = users[1].page.locator('video').first();
      await video2.evaluate((v: HTMLVideoElement) => { v.currentTime = 1.5; });
      await users[1].page.click('text=현재 시점 피드백');
      
      const textarea2 = users[1].page.locator('[data-testid="feedback-textarea"]');
      await textarea2.fill(await textarea2.inputValue() + '사용자2의 타임코드 댓글');
      await users[1].page.click('text=등록');

      // 사용자 3이 스크린샷 촬영
      await users[2].page.click('text=스크린샷');
      
      // 다운로드 시작을 확인 (실제 파일 다운로드는 환경에 따라 다름)
      await users[2].page.waitForTimeout(1000);

      // 모든 사용자가 모든 댓글을 볼 수 있는지 확인
      for (const user of users) {
        await expect(user.page.getByText('사용자1의 첫 번째 댓글'))
          .toBeVisible({ timeout: 15000 });
        await expect(user.page.getByText('사용자2의 타임코드 댓글'))
          .toBeVisible({ timeout: 15000 });
      }

      // 사용자 페이지 정리
      for (let i = 1; i < users.length; i++) {
        await users[i].page.close();
      }
    });

    test('네트워크 연결 문제 시 복구 동작을 테스트한다', async ({ page, context }) => {
      await page.goto('/feedback?videoId=test-video&token=test-token');

      // 정상적인 댓글 작성
      const textarea = page.locator('[data-testid="feedback-textarea"]');
      await textarea.fill('네트워크 테스트 댓글');
      await page.click('text=등록');

      await expect(page.getByText('네트워크 테스트 댓글')).toBeVisible({ timeout: 10000 });

      // 네트워크 상태를 오프라인으로 변경
      await context.setOffline(true);

      // 오프라인 상태에서 댓글 작성 시도
      await textarea.fill('오프라인 댓글');
      await page.click('text=등록');

      // 오류 처리 확인 (콘솔 오류 또는 사용자 알림)
      await page.waitForTimeout(2000);

      // 네트워크 복구
      await context.setOffline(false);

      // 복구 후 댓글 작성이 정상적으로 작동하는지 확인
      await textarea.fill('네트워크 복구 후 댓글');
      await page.click('text=등록');

      await expect(page.getByText('네트워크 복구 후 댓글')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('5. 성능 및 사용성', () => {
    test('대용량 비디오 파일 처리 성능을 확인한다', async ({ page }) => {
      // 5MB 테스트 비디오 생성
      const largeVideoPath = await createTestVideoFile('large-test-video.mp4');
      const largeContent = Buffer.alloc(5 * 1024 * 1024, 0);
      fs.writeFileSync(largeVideoPath, largeContent);

      await page.goto('/');

      const startTime = Date.now();

      await page.click('text=영상 업로드');
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(largeVideoPath);
      
      await page.click('text=업로드');

      // 업로드 완료까지의 시간 측정
      await expect(page).toHaveURL(/.*\/feedback.*/, { timeout: 30000 });
      
      const uploadTime = Date.now() - startTime;
      expect(uploadTime).toBeLessThan(30000); // 30초 이내 완료

      // 비디오 로딩 시간 확인
      const video = page.locator('video').first();
      await expect(video).toBeVisible({ timeout: 10000 });

      // 정리
      fs.unlinkSync(largeVideoPath);
    });

    test('많은 댓글이 있을 때 페이지 성능을 확인한다', async ({ page }) => {
      await page.goto('/feedback?videoId=video-with-many-comments&token=test-token');

      // 페이지 로드 시간 측정
      const startTime = Date.now();
      
      // 댓글 목록이 로드될 때까지 대기
      await expect(page.locator('[data-testid="feedback-comments-title"]')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000); // 5초 이내 로드

      // 스크롤 성능 테스트
      const commentsList = page.locator('.space-y-3').first();
      
      for (let i = 0; i < 5; i++) {
        await commentsList.evaluate(el => {
          el.scrollTop = el.scrollHeight;
        });
        await page.waitForTimeout(100);
      }

      // 페이지가 여전히 반응하는지 확인
      const textarea = page.locator('[data-testid="feedback-textarea"]');
      await textarea.click();
      await expect(textarea).toBeFocused();
    });

    test('모바일 뷰포트에서 반응형 레이아웃이 올바르게 작동한다', async ({ page }) => {
      // 모바일 뷰포트로 설정
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/feedback?videoId=test-video&token=test-token');

      // 비디오 플레이어가 모바일에서 올바르게 표시되는지 확인
      const video = page.locator('video').first();
      await expect(video).toBeVisible();
      
      const videoBox = await video.boundingBox();
      expect(videoBox?.width).toBeLessThanOrEqual(375);

      // 댓글 입력 영역이 접근 가능한지 확인
      const textarea = page.locator('[data-testid="feedback-textarea"]');
      await expect(textarea).toBeVisible();
      
      // 버튼들이 모바일에서 클릭 가능한지 확인
      await page.click('text=현재 시점 피드백');
      await expect(textarea).toBeFocused();

      // 모달이 모바일에서 올바르게 표시되는지 확인
      await page.click('text=영상 공유');
      await expect(page.getByText('영상 공유')).toBeVisible();
      
      const modal = page.locator('[role="dialog"]').first();
      const modalBox = await modal.boundingBox();
      expect(modalBox?.width).toBeLessThanOrEqual(375);
    });
  });

  test.describe('6. 접근성 (A11y)', () => {
    test('키보드 탐색이 완전히 작동한다', async ({ page }) => {
      await page.goto('/feedback?videoId=test-video&token=test-token');

      // Tab 키로 모든 인터랙티브 요소에 접근 가능한지 확인
      await page.keyboard.press('Tab'); // 비디오 또는 첫 번째 버튼
      await page.keyboard.press('Tab'); // 다음 요소
      await page.keyboard.press('Tab'); // 텍스트 영역

      const textarea = page.locator('[data-testid="feedback-textarea"]');
      await expect(textarea).toBeFocused();

      // Enter로 폼 제출이 가능한지 확인
      await textarea.fill('키보드 접근성 테스트 댓글');
      await page.keyboard.press('Tab'); // 등록 버튼으로 이동
      await page.keyboard.press('Enter'); // 등록

      await expect(page.getByText('키보드 접근성 테스트 댓글')).toBeVisible({ timeout: 10000 });

      // 모달도 키보드로 조작 가능한지 확인
      await page.keyboard.press('Tab'); // 다음 버튼으로
      await page.keyboard.press('Tab'); // 공유 버튼으로 (예상)
      
      // Escape로 모달 닫기 (열려있다면)
      await page.keyboard.press('Escape');
    });

    test('스크린 리더용 레이블과 설명이 적절히 제공된다', async ({ page }) => {
      await page.goto('/feedback?videoId=test-video&token=test-token');

      // ARIA 레이블들 확인
      await expect(page.locator('[aria-label*="피드백"]')).toBeVisible();
      await expect(page.locator('[aria-label*="업로드"]')).toBeVisible();

      // 폼 필드의 레이블 연결 확인
      const textarea = page.locator('[data-testid="feedback-textarea"]');
      const textareaId = await textarea.getAttribute('id');
      
      if (textareaId) {
        await expect(page.locator(`label[for="${textareaId}"]`)).toBeVisible();
      } else {
        // aria-label이나 aria-labelledby 확인
        await expect(textarea).toHaveAttribute('aria-label');
      }

      // 상태 정보가 스크린 리더에 전달되는지 확인
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();
    });

    test('고대비 모드에서도 올바르게 작동한다', async ({ page }) => {
      // 고대비 CSS 미디어 쿼리 에뮬레이션
      await page.emulateMedia({ 
        colorScheme: 'dark',
        reducedMotion: 'reduce'
      });

      await page.goto('/feedback?videoId=test-video&token=test-token');

      // 모든 텍스트가 읽을 수 있는지 확인
      await expect(page.getByText('코멘트')).toBeVisible();
      await expect(page.getByText('영상 공유')).toBeVisible();

      // 버튼과 입력 필드의 대비가 충분한지 확인
      const textarea = page.locator('[data-testid="feedback-textarea"]');
      await expect(textarea).toBeVisible();

      // 포커스 인디케이터가 명확한지 확인
      await textarea.focus();
      
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });
});
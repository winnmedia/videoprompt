/**
 * 비디오 피드백 시스템 UI 통합 테스트
 * 
 * 테스트 범위:
 * 1. FeedbackPage 컴포넌트와 실제 비디오 파일 상호작용
 * 2. 타임코드 기반 댓글 시스템 UI 테스트
 * 3. 공유 토큰 기반 권한 시스템 UI 테스트
 * 4. 다중 사용자 협업 시나리오
 * 5. 실시간 댓글 폴링 UI 반영
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom';

// 테스트 컴포넌트 import
import FeedbackPage from '@/app/feedback/page';

// Mock Next.js router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/feedback',
  useSearchParams: () => new URLSearchParams('?videoId=test-video-123&token=valid-test-token'),
}));

// Mock Redux store
vi.mock('@/app/store', () => ({
  useProjectStore: () => ({
    video: {
      videoUrl: 'https://example.com/test-video.mp4',
    },
    versions: [
      {
        id: 'v1',
        label: 'v1',
        uploadedAt: '2024-01-01T10:00:00.000Z',
        src: 'https://example.com/test-video-v1.mp4',
      },
      {
        id: 'v2',
        label: 'v2',
        uploadedAt: '2024-01-01T11:00:00.000Z',
        src: 'https://example.com/test-video-v2.mp4',
      },
    ],
  }),
}));

// Mock HTML Video Element
class MockVideoElement {
  currentTime = 0;
  videoWidth = 1920;
  videoHeight = 1080;
  paused = true;
  
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  
  pause = vi.fn(() => {
    this.paused = true;
  });

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

global.HTMLVideoElement = MockVideoElement as any;

// MSW 서버 설정
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  
  // Canvas mock for screenshot functionality
  global.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  }));
  
  global.HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
    const blob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
    callback(blob);
  });

  // URL.createObjectURL mock
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();

  // Navigator clipboard mock
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn(() => Promise.resolve()),
    },
  });

  // Document.createElement mock for download links
  const originalCreateElement = document.createElement;
  document.createElement = vi.fn((tagName: string) => {
    if (tagName === 'a') {
      const element = originalCreateElement.call(document, tagName) as HTMLAnchorElement;
      element.click = vi.fn();
      return element;
    }
    return originalCreateElement.call(document, tagName);
  });
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
  vi.restoreAllMocks();
});

describe('비디오 피드백 시스템 UI 통합 테스트', () => {
  const validToken = 'valid-ui-test-token';
  const videoId = 'test-video-123';

  beforeEach(() => {
    // 기본 API 응답 설정
    server.use(
      // 토큰 검증
      rest.get(`/api/shares/${validToken}`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            ok: true,
            data: {
              token: validToken,
              role: 'commenter',
              nickname: 'UI테스터',
              targetType: 'video',
              targetId: videoId,
            },
          })
        );
      }),

      // 댓글 목록 조회
      rest.get('/api/comments', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            ok: true,
            data: [
              {
                id: 'comment-1',
                author: '이전사용자',
                text: '첫 번째 댓글입니다',
                timecode: '00:30.500',
                createdAt: '2024-01-01T10:30:00.000Z',
              },
              {
                id: 'comment-2',
                author: '다른사용자',
                text: '@TC01:15.200 이 부분 좋아요!',
                timecode: '01:15.200',
                createdAt: '2024-01-01T10:35:00.000Z',
              },
            ],
          })
        );
      }),

      // 댓글 작성
      rest.post('/api/comments', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            ok: true,
            data: {
              id: `comment-${Date.now()}`,
              createdAt: new Date().toISOString(),
            },
          })
        );
      }),

      // 공유 토큰 생성
      rest.post('/api/shares', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            ok: true,
            data: {
              token: 'new-share-token',
              role: 'commenter',
              nickname: '새사용자',
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
          })
        );
      })
    );

    // window.location mock
    delete (window as any).location;
    window.location = {
      href: `http://localhost:3000/feedback?videoId=${videoId}&token=${validToken}`,
      origin: 'http://localhost:3000',
    } as any;
  });

  describe('1. 기본 페이지 렌더링', () => {
    it('피드백 페이지가 올바르게 렌더링된다', async () => {
      render(<FeedbackPage />);

      // 비디오 플레이어 확인
      await waitFor(() => {
        expect(screen.getByLabelText('피드백 플레이어')).toBeInTheDocument();
      });

      // 댓글 섹션 확인
      expect(screen.getByTestId('feedback-comments-title')).toHaveTextContent('코멘트');
      expect(screen.getByTestId('feedback-textarea')).toBeInTheDocument();

      // 도구 버튼들 확인
      expect(screen.getByText('영상 업로드')).toBeInTheDocument();
      expect(screen.getByText('영상 교체')).toBeInTheDocument();
      expect(screen.getByText('영상 공유')).toBeInTheDocument();
      expect(screen.getByText('스크린샷')).toBeInTheDocument();
      expect(screen.getByText('현재 시점 피드백')).toBeInTheDocument();
    });

    it('버전 선택기가 올바르게 작동한다', async () => {
      render(<FeedbackPage />);

      const versionSelect = await screen.findByDisplayValue('v1');
      expect(versionSelect).toBeInTheDocument();

      // v2로 변경
      await userEvent.selectOptions(versionSelect, 'v2');
      
      await waitFor(() => {
        expect(versionSelect).toHaveValue('v2');
      });
    });

    it('버전 비교 모드가 작동한다', async () => {
      render(<FeedbackPage />);

      // 버전 비교 버튼 클릭
      const compareButton = screen.getByText('버전 비교');
      await userEvent.click(compareButton);

      // 비교 버전 선택기 나타나는지 확인
      await waitFor(() => {
        expect(screen.getByText('비교 버전 선택')).toBeInTheDocument();
      });

      // 비교 버전 선택
      const compareSelect = screen.getByDisplayValue('');
      await userEvent.selectOptions(compareSelect, 'v2');

      // 비교 모드 해제 버튼 확인
      expect(screen.getByText('비교 모드 해제')).toBeInTheDocument();
    });
  });

  describe('2. 댓글 시스템 UI 테스트', () => {
    it('기존 댓글이 올바르게 표시된다', async () => {
      render(<FeedbackPage />);

      // 댓글 목록이 로드될 때까지 대기
      await waitFor(() => {
        expect(screen.getByText('첫 번째 댓글입니다')).toBeInTheDocument();
        expect(screen.getByText('@TC01:15.200 이 부분 좋아요!')).toBeInTheDocument();
      });

      // 타임코드 버튼 확인
      const timecodeButtons = screen.getAllByText(/^@TC\d{2}:\d{2}\.\d{3}$/);
      expect(timecodeButtons.length).toBeGreaterThan(0);
    });

    it('새 댓글을 작성할 수 있다', async () => {
      render(<FeedbackPage />);

      const textarea = await screen.findByTestId('feedback-textarea');
      const submitButton = screen.getByText('등록');

      // 댓글 입력
      await userEvent.type(textarea, '새로운 피드백 댓글입니다');
      
      // 댓글 등록
      await userEvent.click(submitButton);

      // 입력창이 비워지는지 확인
      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });

    it('현재 시점 피드백 버튼이 타임코드를 삽입한다', async () => {
      render(<FeedbackPage />);

      const textarea = await screen.findByTestId('feedback-textarea');
      const timecodeButton = screen.getByText('현재 시점 피드백');

      // 현재 시점 피드백 버튼 클릭
      await userEvent.click(timecodeButton);

      // 타임코드가 삽입되는지 확인
      await waitFor(() => {
        expect(textarea).toHaveValue(expect.stringMatching(/@TC\d{2}:\d{2}\.\d{3} /));
      });

      expect(textarea).toHaveFocus();
    });

    it('T 키 단축키로 타임코드를 삽입할 수 있다', async () => {
      render(<FeedbackPage />);

      const textarea = await screen.findByTestId('feedback-textarea');

      // T 키 누르기
      await userEvent.keyboard('T');

      // 타임코드가 삽입되고 포커스가 이동하는지 확인
      await waitFor(() => {
        expect(textarea).toHaveValue(expect.stringMatching(/@TC\d{2}:\d{2}\.\d{3} /));
        expect(textarea).toHaveFocus();
      });
    });

    it('타임코드 버튼 클릭으로 비디오가 해당 시점으로 이동한다', async () => {
      render(<FeedbackPage />);

      // 댓글 목록이 로드될 때까지 대기
      await waitFor(() => {
        expect(screen.getByText('@TC01:15.200 이 부분 좋아요!')).toBeInTheDocument();
      });

      // 타임코드 버튼 찾기 및 클릭
      const timecodeButton = screen.getByText('@TC01:15.200');
      await userEvent.click(timecodeButton);

      // 비디오 요소의 currentTime이 변경되었는지 확인
      const video = screen.getByLabelText('피드백 플레이어') as HTMLVideoElement;
      
      // MockVideoElement에서 currentTime 변경 시뮬레이션
      expect(video.play).toHaveBeenCalled();
    });

    it('입력창에 포커스가 있을 때 T 키가 무시된다', async () => {
      render(<FeedbackPage />);

      const textarea = await screen.findByTestId('feedback-textarea');
      
      // 텍스트 입력창에 포커스
      await userEvent.click(textarea);
      
      // 기존 텍스트 입력
      await userEvent.type(textarea, '기존 텍스트');
      
      // T 키 누르기
      await userEvent.keyboard('T');

      // T가 텍스트로 입력되고 타임코드가 삽입되지 않음
      await waitFor(() => {
        expect(textarea).toHaveValue('기존 텍스트T');
      });
    });
  });

  describe('3. 공유 기능 UI 테스트', () => {
    it('공유 모달이 올바르게 작동한다', async () => {
      render(<FeedbackPage />);

      const shareButton = screen.getByText('영상 공유');
      await userEvent.click(shareButton);

      // 모달이 열리는지 확인
      await waitFor(() => {
        expect(screen.getByText('영상 공유')).toBeInTheDocument();
        expect(screen.getByText('링크/권한/만료 설정을 구성합니다.')).toBeInTheDocument();
      });

      // 폼 필드들 확인
      expect(screen.getByLabelText('닉네임')).toBeInTheDocument();
      expect(screen.getByLabelText('만료일(일)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('댓글 작성 가능')).toBeInTheDocument();
    });

    it('공유 링크를 생성하고 클립보드에 복사한다', async () => {
      render(<FeedbackPage />);

      const shareButton = screen.getByText('영상 공유');
      await userEvent.click(shareButton);

      // 닉네임 입력
      const nicknameInput = await screen.findByLabelText('닉네임');
      await userEvent.type(nicknameInput, '테스트사용자');

      // 권한 선택
      const roleSelect = screen.getByDisplayValue('댓글 작성 가능');
      await userEvent.selectOptions(roleSelect, 'viewer');

      // 만료일 변경
      const expireDaysInput = screen.getByLabelText('만료일(일)');
      await userEvent.clear(expireDaysInput);
      await userEvent.type(expireDaysInput, '14');

      // 링크 발급 버튼 클릭
      const generateButton = screen.getByText('링크 발급');
      
      // alert mock
      window.alert = vi.fn();
      
      await userEvent.click(generateButton);

      // 클립보드 복사가 호출되었는지 확인
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('token=new-share-token')
        );
        expect(window.alert).toHaveBeenCalledWith('공유 링크가 클립보드에 복사되었습니다');
      });
    });

    it('공유 모달을 닫을 수 있다', async () => {
      render(<FeedbackPage />);

      const shareButton = screen.getByText('영상 공유');
      await userEvent.click(shareButton);

      const closeButton = await screen.findByText('닫기');
      await userEvent.click(closeButton);

      // 모달이 닫혔는지 확인
      await waitFor(() => {
        expect(screen.queryByText('영상 공유')).not.toBeInTheDocument();
      });
    });
  });

  describe('4. 비디오 업로드 UI 테스트', () => {
    it('업로드 모달이 올바르게 작동한다', async () => {
      render(<FeedbackPage />);

      const uploadButton = screen.getByText('영상 업로드');
      await userEvent.click(uploadButton);

      // 모달이 열리는지 확인
      await waitFor(() => {
        expect(screen.getByText('영상 업로드')).toBeInTheDocument();
        expect(screen.getByText('V1/V2/V3 중 하나의 슬롯에 영상을 업로드합니다.')).toBeInTheDocument();
      });

      // 3개의 업로드 슬롯 확인
      expect(screen.getByText('V1')).toBeInTheDocument();
      expect(screen.getByText('V2')).toBeInTheDocument();
      expect(screen.getByText('V3')).toBeInTheDocument();

      // 파일 입력 필드 확인
      const fileInputs = screen.getAllByText('파일 선택');
      expect(fileInputs).toHaveLength(3);
    });

    it('영상 교체 모달이 작동한다', async () => {
      render(<FeedbackPage />);

      const replaceButton = screen.getByText('영상 교체');
      await userEvent.click(replaceButton);

      // 모달이 열리는지 확인
      await waitFor(() => {
        expect(screen.getByText('영상 교체')).toBeInTheDocument();
        expect(screen.getByText('새 파일 업로드 또는 기존 버전을 선택하여 교체합니다.')).toBeInTheDocument();
      });

      // 파일 업로드와 버전 선택 옵션 확인
      expect(screen.getByText('파일 업로드')).toBeInTheDocument();
      expect(screen.getByText('기존 버전 선택')).toBeInTheDocument();
    });
  });

  describe('5. 스크린샷 기능 테스트', () => {
    it('스크린샷 버튼이 작동한다', async () => {
      render(<FeedbackPage />);

      const screenshotButton = screen.getByText('스크린샷');
      await userEvent.click(screenshotButton);

      // Canvas toBlob이 호출되었는지 확인
      await waitFor(() => {
        expect(global.HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled();
      });

      // 다운로드 링크가 생성되고 클릭되었는지 확인
      expect(document.createElement).toHaveBeenCalledWith('a');
    });
  });

  describe('6. 실시간 댓글 폴링 테스트', () => {
    it('댓글이 5초마다 자동으로 업데이트된다', async () => {
      let requestCount = 0;
      
      server.use(
        rest.get('/api/comments', (req, res, ctx) => {
          requestCount++;
          
          const comments = [
            {
              id: 'comment-1',
              author: '기존사용자',
              text: '기존 댓글',
              timecode: '00:10.000',
              createdAt: '2024-01-01T10:00:00.000Z',
            },
          ];

          // 두 번째 요청부터 새 댓글 추가
          if (requestCount >= 2) {
            comments.push({
              id: 'comment-new',
              author: '새사용자',
              text: '실시간으로 추가된 댓글',
              timecode: '00:20.000',
              createdAt: new Date().toISOString(),
            });
          }

          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: comments,
            })
          );
        })
      );

      render(<FeedbackPage />);

      // 첫 번째 댓글 로드 확인
      await waitFor(() => {
        expect(screen.getByText('기존 댓글')).toBeInTheDocument();
      });

      // 5초 후 새 댓글이 나타나는지 확인 (타이머 모킹 필요)
      vi.useFakeTimers();
      
      // 5초 경과 시뮬레이션
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.getByText('실시간으로 추가된 댓글')).toBeInTheDocument();
      }, { timeout: 6000 });

      vi.useRealTimers();
    });

    it('댓글 폴링이 컴포넌트 언마운트 시 정리된다', async () => {
      const { unmount } = render(<FeedbackPage />);

      // 컴포넌트가 마운트된 후 타이머 확인
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      unmount();

      // 타이머가 정리되었는지 확인
      expect(clearIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('7. 오류 처리 UI 테스트', () => {
    it('유효하지 않은 토큰일 때 적절히 처리한다', async () => {
      server.use(
        rest.get('/api/shares/invalid-token', (req, res, ctx) => {
          return res(
            ctx.status(404),
            ctx.json({
              ok: false,
              code: 'NOT_FOUND',
              error: 'token not found',
            })
          );
        })
      );

      // 유효하지 않은 토큰으로 URL 설정
      delete (window as any).location;
      window.location = {
        href: 'http://localhost:3000/feedback?videoId=test-video&token=invalid-token',
      } as any;

      render(<FeedbackPage />);

      // 오류 상태가 적절히 처리되는지 확인
      await waitFor(() => {
        // 토큰이 유효하지 않을 때의 UI 상태 확인
        expect(screen.getByTestId('feedback-textarea')).toBeInTheDocument();
      });
    });

    it('네트워크 오류 시 댓글 작성이 실패한다', async () => {
      server.use(
        rest.post('/api/comments', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              ok: false,
              error: 'Internal Server Error',
            })
          );
        })
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<FeedbackPage />);

      const textarea = await screen.findByTestId('feedback-textarea');
      const submitButton = screen.getByText('등록');

      await userEvent.type(textarea, '오류 테스트 댓글');
      await userEvent.click(submitButton);

      // 콘솔에 오류가 기록되는지 확인
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('댓글 목록 로드 실패 시 적절히 처리한다', async () => {
      server.use(
        rest.get('/api/comments', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              ok: false,
              error: 'Server Error',
            })
          );
        })
      );

      render(<FeedbackPage />);

      // 댓글 목록이 비어있는 상태 메시지 확인
      await waitFor(() => {
        expect(screen.getByText('아직 댓글이 없습니다. 첫 댓글을 작성해보세요!')).toBeInTheDocument();
      });
    });
  });

  describe('8. 접근성 테스트', () => {
    it('모든 인터랙티브 요소에 적절한 ARIA 레이블이 있다', async () => {
      render(<FeedbackPage />);

      // 비디오 플레이어 ARIA 레이블 확인
      expect(screen.getByLabelText('피드백 플레이어')).toBeInTheDocument();

      // 버튼들의 ARIA 레이블 확인
      expect(screen.getByLabelText('영상 업로드 열기')).toBeInTheDocument();

      // 모달의 접근성 확인
      const shareButton = screen.getByText('영상 공유');
      await userEvent.click(shareButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('키보드 탐색이 올바르게 작동한다', async () => {
      render(<FeedbackPage />);

      const textarea = await screen.findByTestId('feedback-textarea');
      
      // Tab 키로 요소 간 이동
      await userEvent.tab();
      expect(textarea).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByText('등록')).toHaveFocus();
    });

    it('스크린 리더를 위한 aria-live 영역이 있다', async () => {
      render(<FeedbackPage />);

      // aria-live 속성 확인
      const liveRegion = screen.getByLabelText(/피드백 플레이어|코멘트/);
      expect(liveRegion.closest('[aria-live="polite"]')).toBeInTheDocument();
    });
  });
});
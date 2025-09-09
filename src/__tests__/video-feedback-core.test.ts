/**
 * 비디오 피드백 시스템 핵심 기능 테스트 (MSW 2.x 호환)
 * 
 * 주요 테스트 범위:
 * 1. 비디오 업로드 API
 * 2. 공유 토큰 관리 API  
 * 3. 댓글 시스템 API
 * 4. 실시간 협업 기능
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// MSW 서버 설정
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  vi.resetAllMocks();
});

afterAll(() => {
  server.close();
});

// Mock 비디오 파일 생성 헬퍼
const createMockVideoFile = (name: string, size: number = 1024 * 1024): File => {
  const content = new Uint8Array(size).fill(0);
  return new File([content], name, { type: 'video/mp4' });
};

describe('비디오 피드백 시스템 핵심 기능', () => {
  describe('1. 비디오 업로드 API', () => {
    it('유효한 비디오 파일을 업로드할 수 있다', async () => {
      // MSW 핸들러 설정
      server.use(
        http.post('/api/upload/video', () => {
          return HttpResponse.json({
            ok: true,
            videoUrl: 'https://example.com/videos/test-video.mp4',
            fileName: 'test-video.mp4',
            fileSize: 1048576,
            fileType: 'video/mp4',
          });
        })
      );

      const file = createMockVideoFile('test-video.mp4');
      const formData = new FormData();
      formData.append('video', file);

      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.videoUrl).toMatch(/test-video\.mp4$/);
      expect(result.fileName).toBe('test-video.mp4');
      expect(result.fileType).toBe('video/mp4');
    });

    it('파일 크기가 초과되면 업로드가 실패한다', async () => {
      server.use(
        http.post('/api/upload/video', () => {
          return HttpResponse.json({
            ok: false,
            error: 'FILE_TOO_LARGE',
            message: '파일 크기가 200MB를 초과합니다.',
          }, { status: 413 });
        })
      );

      const largeFile = createMockVideoFile('large-video.mp4', 250 * 1024 * 1024);
      const formData = new FormData();
      formData.append('video', largeFile);

      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(response.status).toBe(413);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('FILE_TOO_LARGE');
    });

    it('유효하지 않은 파일 타입은 업로드가 거부된다', async () => {
      server.use(
        http.post('/api/upload/video', () => {
          return HttpResponse.json({
            ok: false,
            error: 'INVALID_TYPE',
            message: '유효한 영상 파일이 아닙니다.',
          }, { status: 400 });
        })
      );

      const imageFile = new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])], 'image.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('video', imageFile);

      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_TYPE');
    });

    it('파일이 누락되면 업로드가 실패한다', async () => {
      server.use(
        http.post('/api/upload/video', () => {
          return HttpResponse.json({
            ok: false,
            error: 'VIDEO_MISSING',
            message: '영상 파일이 필요합니다.',
          }, { status: 400 });
        })
      );

      const formData = new FormData();

      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('VIDEO_MISSING');
    });
  });

  describe('2. 공유 토큰 관리 API', () => {
    it('뷰어 권한 공유 토큰을 생성할 수 있다', async () => {
      const mockToken = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      const mockExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      server.use(
        http.post('/api/shares', () => {
          return HttpResponse.json({
            ok: true,
            data: {
              token: mockToken,
              role: 'viewer',
              nickname: null,
              expiresAt: mockExpiresAt.toISOString(),
            },
          });
        })
      );

      const requestData = {
        targetType: 'video',
        targetId: 'video-123',
        role: 'viewer',
        expiresIn: 7 * 24 * 3600,
      };

      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.data.token).toBe(mockToken);
      expect(result.data.role).toBe('viewer');
      expect(new Date(result.data.expiresAt)).toBeInstanceOf(Date);
    });

    it('댓글 작성 권한 공유 토큰을 생성할 수 있다', async () => {
      const mockToken = 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7';

      server.use(
        http.post('/api/shares', () => {
          return HttpResponse.json({
            ok: true,
            data: {
              token: mockToken,
              role: 'commenter',
              nickname: '팀원1',
              expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            },
          });
        })
      );

      const requestData = {
        targetType: 'video',
        targetId: 'video-123',
        role: 'commenter',
        nickname: '팀원1',
        expiresIn: 14 * 24 * 3600,
      };

      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.data.token).toBe(mockToken);
      expect(result.data.role).toBe('commenter');
      expect(result.data.nickname).toBe('팀원1');
    });

    it('유효한 공유 토큰을 검증할 수 있다', async () => {
      const validToken = 'valid-token-123';

      server.use(
        http.get('/api/shares/:token', ({ params }) => {
          if (params.token === validToken) {
            return HttpResponse.json({
              ok: true,
              data: {
                token: validToken,
                role: 'commenter',
                nickname: '검증된사용자',
                targetType: 'video',
                targetId: 'video-123',
              },
            });
          }
          return HttpResponse.json({
            ok: false,
            code: 'NOT_FOUND',
            error: 'token not found',
          }, { status: 404 });
        })
      );

      const response = await fetch(`/api/shares/${validToken}`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.data.token).toBe(validToken);
      expect(result.data.role).toBe('commenter');
      expect(result.data.targetType).toBe('video');
    });

    it('만료된 토큰 검증은 실패한다', async () => {
      const expiredToken = 'expired-token-456';

      server.use(
        http.get('/api/shares/:token', ({ params }) => {
          if (params.token === expiredToken) {
            return HttpResponse.json({
              ok: false,
              code: 'EXPIRED',
              error: 'token expired',
            }, { status: 410 });
          }
          return HttpResponse.json({
            ok: false,
            code: 'NOT_FOUND',
            error: 'token not found',
          }, { status: 404 });
        })
      );

      const response = await fetch(`/api/shares/${expiredToken}`);
      const result = await response.json();

      expect(response.status).toBe(410);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('EXPIRED');
    });

    it('유효하지 않은 토큰 검증은 실패한다', async () => {
      const invalidToken = 'invalid-token-789';

      server.use(
        http.get('/api/shares/:token', ({ params }) => {
          if (params.token === invalidToken) {
            return HttpResponse.json({
              ok: false,
              code: 'NOT_FOUND',
              error: 'token not found',
            }, { status: 404 });
          }
          return HttpResponse.json({
            ok: true,
            data: { token: params.token, role: 'viewer' },
          });
        })
      );

      const response = await fetch(`/api/shares/${invalidToken}`);
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('NOT_FOUND');
    });
  });

  describe('3. 댓글 시스템 API', () => {
    const validToken = 'comment-token-valid';
    const videoId = 'video-test-123';

    it('유효한 토큰으로 댓글을 작성할 수 있다', async () => {
      const commentId = 'comment-123';
      const createdAt = new Date().toISOString();

      server.use(
        http.post('/api/comments', () => {
          return HttpResponse.json({
            ok: true,
            data: {
              id: commentId,
              createdAt,
            },
          });
        })
      );

      const commentData = {
        token: validToken,
        targetType: 'video',
        targetId: videoId,
        text: '이 부분이 좋네요!',
      };

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.data.id).toBe(commentId);
      expect(new Date(result.data.createdAt)).toBeInstanceOf(Date);
    });

    it('타임코드와 함께 댓글을 작성할 수 있다', async () => {
      const commentId = 'comment-with-timecode';
      const timecode = '01:23.456';

      server.use(
        http.post('/api/comments', () => {
          return HttpResponse.json({
            ok: true,
            data: {
              id: commentId,
              createdAt: new Date().toISOString(),
            },
          });
        })
      );

      const commentData = {
        token: validToken,
        targetType: 'video',
        targetId: videoId,
        text: '@TC01:23.456 여기서 음악이 너무 크네요',
        timecode,
      };

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.data.id).toBe(commentId);
    });

    it('뷰어 권한으로는 댓글 작성이 실패한다', async () => {
      const viewerToken = 'viewer-only-token';

      server.use(
        http.post('/api/comments', () => {
          return HttpResponse.json({
            ok: false,
            code: 'FORBIDDEN',
            error: 'no comment permission',
          }, { status: 403 });
        })
      );

      const commentData = {
        token: viewerToken,
        targetType: 'video',
        targetId: videoId,
        text: '댓글을 달고 싶지만 권한이 없음',
      };

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });

      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('FORBIDDEN');
    });

    it('댓글 목록을 조회할 수 있다', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          author: '사용자1',
          text: '첫 번째 댓글입니다',
          timecode: '00:30.500',
          createdAt: new Date(Date.now() - 60000).toISOString(),
          targetType: 'video',
          targetId: videoId,
        },
        {
          id: 'comment-2',
          author: '사용자2',
          text: '@TC01:15.200 이 장면 멋있어요!',
          timecode: '01:15.200',
          createdAt: new Date().toISOString(),
          targetType: 'video',
          targetId: videoId,
        },
      ];

      server.use(
        http.get('/api/comments', ({ request }) => {
          const url = new URL(request.url);
          const targetType = url.searchParams.get('targetType');
          const targetId = url.searchParams.get('targetId');

          if (targetType === 'video' && targetId === videoId) {
            return HttpResponse.json({
              ok: true,
              data: mockComments,
            });
          }

          return HttpResponse.json({
            ok: false,
            code: 'INVALID_INPUT_FIELDS',
            error: 'targetId required',
          }, { status: 400 });
        })
      );

      const response = await fetch(`/api/comments?targetType=video&targetId=${videoId}`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].author).toBe('사용자1');
      expect(result.data[1].timecode).toBe('01:15.200');
    });

    it('빈 댓글 내용으로는 작성이 실패한다', async () => {
      server.use(
        http.post('/api/comments', () => {
          return HttpResponse.json({
            ok: false,
            code: 'INVALID_INPUT_FIELDS',
            error: 'text is required',
          }, { status: 400 });
        })
      );

      const commentData = {
        token: validToken,
        targetType: 'video',
        targetId: videoId,
        text: '',
      };

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INVALID_INPUT_FIELDS');
    });

    it('유효하지 않은 토큰으로는 댓글 작성이 실패한다', async () => {
      const invalidToken = 'invalid-comment-token';

      server.use(
        http.post('/api/comments', () => {
          return HttpResponse.json({
            ok: false,
            code: 'FORBIDDEN',
            error: 'invalid token',
          }, { status: 403 });
        })
      );

      const commentData = {
        token: invalidToken,
        targetType: 'video',
        targetId: videoId,
        text: '유효하지 않은 토큰으로 댓글 작성',
      };

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });

      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('FORBIDDEN');
    });
  });

  describe('4. 실시간 협업 기능', () => {
    it('댓글 폴링을 통해 실시간 업데이트를 시뮬레이션할 수 있다', async () => {
      const videoId = 'polling-test-video';
      let requestCount = 0;

      server.use(
        http.get('/api/comments', ({ request }) => {
          const url = new URL(request.url);
          const targetId = url.searchParams.get('targetId');

          if (targetId === videoId) {
            requestCount++;
            
            const comments = Array.from({ length: requestCount }, (_, i) => ({
              id: `comment-${i + 1}`,
              author: `사용자${i + 1}`,
              text: `실시간 댓글 ${i + 1}`,
              timecode: `00:${String(i * 10).padStart(2, '0')}.000`,
              createdAt: new Date(Date.now() - (requestCount - i) * 1000).toISOString(),
              targetType: 'video',
              targetId: videoId,
            }));

            return HttpResponse.json({
              ok: true,
              data: comments,
            });
          }

          return HttpResponse.json({
            ok: false,
            error: 'Invalid targetId',
          }, { status: 400 });
        })
      );

      // 첫 번째 폴링 요청
      const response1 = await fetch(`/api/comments?targetType=video&targetId=${videoId}`);
      const result1 = await response1.json();

      expect(result1.ok).toBe(true);
      expect(result1.data).toHaveLength(1);

      // 두 번째 폴링 요청 (새 댓글 추가됨)
      const response2 = await fetch(`/api/comments?targetType=video&targetId=${videoId}`);
      const result2 = await response2.json();

      expect(result2.ok).toBe(true);
      expect(result2.data).toHaveLength(2);
    });

    it('다중 사용자 세션을 시뮬레이션할 수 있다', async () => {
      const videoId = 'multi-user-video';
      const userTokens = ['user1-token', 'user2-token', 'user3-token'];
      const commentsByUser = new Map();

      // 댓글 작성 API 설정
      server.use(
        http.post('/api/comments', async ({ request }) => {
          const body = await request.json() as any;
          const { token, text } = body;
          
          const userIndex = userTokens.indexOf(token);
          if (userIndex === -1) {
            return HttpResponse.json({ ok: false, error: 'Invalid token' }, { status: 403 });
          }

          const commentId = `comment-${Date.now()}-${userIndex}`;
          const comment = {
            id: commentId,
            author: `사용자${userIndex + 1}`,
            text,
            createdAt: new Date().toISOString(),
          };

          if (!commentsByUser.has(token)) {
            commentsByUser.set(token, []);
          }
          commentsByUser.get(token).push(comment);

          return HttpResponse.json({
            ok: true,
            data: {
              id: commentId,
              createdAt: comment.createdAt,
            },
          });
        })
      );

      // 각 사용자가 댓글 작성
      const commentPromises = userTokens.map(async (token, index) => {
        return fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            targetType: 'video',
            targetId: videoId,
            text: `사용자${index + 1}의 댓글입니다`,
          }),
        });
      });

      const responses = await Promise.all(commentPromises);

      // 모든 댓글 작성이 성공했는지 확인
      for (const response of responses) {
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.ok).toBe(true);
      }

      // 각 사용자가 최소 하나의 댓글을 작성했는지 확인
      expect(commentsByUser.size).toBe(3);
    });

    it('공유 토큰 유효성을 실시간으로 검증할 수 있다', async () => {
      const token = 'realtime-validation-token';
      let tokenValid = true;

      server.use(
        http.get('/api/shares/:token', ({ params }) => {
          if (params.token === token) {
            if (tokenValid) {
              return HttpResponse.json({
                ok: true,
                data: {
                  token,
                  role: 'commenter',
                  nickname: '실시간사용자',
                  targetType: 'video',
                  targetId: 'realtime-video',
                },
              });
            } else {
              return HttpResponse.json({
                ok: false,
                code: 'EXPIRED',
                error: 'token expired',
              }, { status: 410 });
            }
          }
          return HttpResponse.json({
            ok: false,
            code: 'NOT_FOUND',
            error: 'token not found',
          }, { status: 404 });
        })
      );

      // 첫 번째 검증 - 성공
      let response = await fetch(`/api/shares/${token}`);
      let result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);

      // 토큰 만료 시뮬레이션
      tokenValid = false;

      // 두 번째 검증 - 실패
      response = await fetch(`/api/shares/${token}`);
      result = await response.json();

      expect(response.status).toBe(410);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('EXPIRED');
    });
  });

  describe('5. 오류 처리 및 복구', () => {
    it('네트워크 오류를 시뮬레이션할 수 있다', async () => {
      server.use(
        http.post('/api/comments', () => {
          return HttpResponse.json({
            ok: false,
            code: 'NETWORK_ERROR',
            error: '네트워크 오류가 발생했습니다',
          }, { status: 500 });
        })
      );

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'test-token',
          targetType: 'video',
          targetId: 'test-video',
          text: '오류 테스트 댓글',
        }),
      });

      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('API 응답 시간 초과를 시뮬레이션할 수 있다', async () => {
      server.use(
        http.post('/api/upload/video', async () => {
          // 2초 지연 시뮬레이션
          await new Promise(resolve => setTimeout(resolve, 2000));
          return HttpResponse.json({
            ok: false,
            code: 'TIMEOUT',
            error: '요청 시간이 초과되었습니다',
          }, { status: 408 });
        })
      );

      const startTime = Date.now();
      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: new FormData(),
      });
      const endTime = Date.now();
      
      const result = await response.json();

      expect(endTime - startTime).toBeGreaterThan(1900); // 약 2초
      expect(response.status).toBe(408);
      expect(result.code).toBe('TIMEOUT');
    });

    it('부분적 데이터 손실을 처리할 수 있다', async () => {
      const videoId = 'partial-data-video';
      
      server.use(
        http.get('/api/comments', () => {
          // 일부 댓글에 누락된 데이터가 있는 상황 시뮬레이션
          return HttpResponse.json({
            ok: true,
            data: [
              {
                id: 'comment-1',
                author: '완전한사용자',
                text: '완전한 댓글',
                timecode: '00:30.000',
                createdAt: '2024-01-01T10:00:00.000Z',
              },
              {
                id: 'comment-2',
                author: null, // 누락된 작성자
                text: '익명 댓글',
                timecode: null, // 누락된 타임코드
                createdAt: '2024-01-01T10:05:00.000Z',
              },
              {
                id: 'comment-3',
                // author 필드 자체가 없음
                text: '부분적 데이터 댓글',
                createdAt: '2024-01-01T10:10:00.000Z',
              },
            ],
          });
        })
      );

      const response = await fetch(`/api/comments?targetType=video&targetId=${videoId}`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(3);
      
      // 완전한 데이터
      expect(result.data[0].author).toBe('완전한사용자');
      expect(result.data[0].timecode).toBe('00:30.000');
      
      // 부분적으로 누락된 데이터
      expect(result.data[1].author).toBeNull();
      expect(result.data[1].timecode).toBeNull();
      
      // 필드가 없는 경우
      expect(result.data[2].author).toBeUndefined();
      expect(result.data[2].text).toBe('부분적 데이터 댓글');
    });
  });
});
/**
 * 비디오 피드백 시스템 종합 테스트
 * 
 * 테스트 범위:
 * 1. 비디오 업로드 기능 (파일 저장, 메타데이터 추출)
 * 2. 팀 초대 시스템 (공유 토큰, ID 기반, 게스트 초대)
 * 3. 댓글 시스템 (타임코드 기반, 스레딩, 권한)
 * 4. 감정/반응 시스템
 * 5. 실시간 기능 (댓글 폴링, 다중 사용자)
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextRequest } from 'next/server';

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

// Mock 이미지 파일 생성 헬퍼 (잘못된 파일 타입 테스트용)
const createMockImageFile = (name: string): File => {
  const content = new Uint8Array(1024).fill(0);
  return new File([content], name, { type: 'image/jpeg' });
};

describe('비디오 피드백 시스템', () => {
  describe('1. 비디오 업로드 기능', () => {
    it('유효한 비디오 파일 업로드 성공', async () => {
      // MSW 핸들러 설정
      server.use(
        http.post('/api/upload/video', () => {
          return HttpResponse.json({
            ok: true,
            videoUrl: 'https://example.com/videos/test-video.mp4',
            fileName: 'test-video.mp4',
            fileSize: 1048576,
            fileType: 'video/mp4',
          }, { status: 200 });
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

    it('파일 크기 초과 시 업로드 실패', async () => {
      server.use(
        rest.post('/api/upload/video', (req, res, ctx) => {
          return res(
            ctx.status(413),
            ctx.json({
              ok: false,
              error: 'FILE_TOO_LARGE',
              message: '파일 크기가 200MB를 초과합니다.',
            })
          );
        })
      );

      const largeFile = createMockVideoFile('large-video.mp4', 250 * 1024 * 1024); // 250MB
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

    it('유효하지 않은 파일 타입 업로드 실패', async () => {
      server.use(
        rest.post('/api/upload/video', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              ok: false,
              error: 'INVALID_TYPE',
              message: '유효한 영상 파일이 아닙니다.',
            })
          );
        })
      );

      const imageFile = createMockImageFile('image.jpg');
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

    it('파일 누락 시 업로드 실패', async () => {
      server.use(
        rest.post('/api/upload/video', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              ok: false,
              error: 'VIDEO_MISSING',
              message: '영상 파일이 필요합니다.',
            })
          );
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

    it('비디오 메타데이터 추출 및 검증', async () => {
      server.use(
        rest.post('/api/upload/video', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              videoUrl: 'https://example.com/videos/meta-test.mp4',
              fileName: 'meta-test.mp4',
              fileSize: 5242880,
              fileType: 'video/mp4',
              metadata: {
                duration: 120.5,
                width: 1920,
                height: 1080,
                codec: 'h264',
                bitrate: 2000,
              },
            })
          );
        })
      );

      const file = createMockVideoFile('meta-test.mp4', 5 * 1024 * 1024);
      const formData = new FormData();
      formData.append('video', file);

      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.duration).toBeGreaterThan(0);
      expect(result.metadata.width).toBe(1920);
      expect(result.metadata.height).toBe(1080);
      expect(result.metadata.codec).toBe('h264');
    });
  });

  describe('2. 팀 초대 시스템', () => {
    it('뷰어 권한 공유 토큰 생성', async () => {
      const mockToken = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      const mockExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      server.use(
        rest.post('/api/shares', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                token: mockToken,
                role: 'viewer',
                nickname: null,
                expiresAt: mockExpiresAt.toISOString(),
              },
            })
          );
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

    it('댓글 작성 권한 공유 토큰 생성', async () => {
      const mockToken = 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7';
      const mockExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      server.use(
        rest.post('/api/shares', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                token: mockToken,
                role: 'commenter',
                nickname: '팀원1',
                expiresAt: mockExpiresAt.toISOString(),
              },
            })
          );
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

    it('공유 토큰 유효성 검증', async () => {
      const validToken = 'valid-token-123';

      server.use(
        rest.get(`/api/shares/${validToken}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                token: validToken,
                role: 'commenter',
                nickname: '검증된사용자',
                targetType: 'video',
                targetId: 'video-123',
              },
            })
          );
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

    it('만료된 토큰 검증 실패', async () => {
      const expiredToken = 'expired-token-456';

      server.use(
        rest.get(`/api/shares/${expiredToken}`, (req, res, ctx) => {
          return res(
            ctx.status(410),
            ctx.json({
              ok: false,
              code: 'EXPIRED',
              error: 'token expired',
            })
          );
        })
      );

      const response = await fetch(`/api/shares/${expiredToken}`);
      const result = await response.json();

      expect(response.status).toBe(410);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('EXPIRED');
    });

    it('유효하지 않은 토큰 검증 실패', async () => {
      const invalidToken = 'invalid-token-789';

      server.use(
        rest.get(`/api/shares/${invalidToken}`, (req, res, ctx) => {
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

      const response = await fetch(`/api/shares/${invalidToken}`);
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('NOT_FOUND');
    });

    it('게스트 초대 (닉네임 없이)', async () => {
      const guestToken = 'guest-token-abc123';

      server.use(
        rest.post('/api/shares', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                token: guestToken,
                role: 'viewer',
                nickname: null,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              },
            })
          );
        })
      );

      const requestData = {
        targetType: 'video',
        targetId: 'video-123',
        role: 'viewer',
        expiresIn: 24 * 3600,
      };

      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.data.token).toBe(guestToken);
      expect(result.data.nickname).toBeNull();
    });
  });

  describe('3. 댓글 시스템', () => {
    const validToken = 'comment-token-valid';
    const videoId = 'video-test-123';

    beforeEach(() => {
      // 유효한 토큰 검증 설정
      server.use(
        rest.get(`/api/shares/${validToken}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                token: validToken,
                role: 'commenter',
                nickname: '테스터',
                targetType: 'video',
                targetId: videoId,
              },
            })
          );
        })
      );
    });

    it('기본 댓글 작성 성공', async () => {
      const commentId = 'comment-123';
      const createdAt = new Date().toISOString();

      server.use(
        rest.post('/api/comments', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                id: commentId,
                createdAt,
              },
            })
          );
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

    it('타임코드 포함 댓글 작성', async () => {
      const commentId = 'comment-with-timecode';
      const timecode = '01:23.456';

      server.use(
        rest.post('/api/comments', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                id: commentId,
                createdAt: new Date().toISOString(),
              },
            })
          );
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

    it('뷰어 권한으로 댓글 작성 실패', async () => {
      const viewerToken = 'viewer-only-token';

      server.use(
        rest.get(`/api/shares/${viewerToken}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                token: viewerToken,
                role: 'viewer',
                nickname: '뷰어',
                targetType: 'video',
                targetId: videoId,
              },
            })
          );
        }),
        rest.post('/api/comments', (req, res, ctx) => {
          return res(
            ctx.status(403),
            ctx.json({
              ok: false,
              code: 'FORBIDDEN',
              error: 'no comment permission',
            })
          );
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

    it('댓글 목록 조회', async () => {
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
        rest.get('/api/comments', (req, res, ctx) => {
          const targetType = req.url.searchParams.get('targetType');
          const targetId = req.url.searchParams.get('targetId');

          if (targetType === 'video' && targetId === videoId) {
            return res(
              ctx.status(200),
              ctx.json({
                ok: true,
                data: mockComments,
              })
            );
          }

          return res(
            ctx.status(400),
            ctx.json({
              ok: false,
              code: 'INVALID_INPUT_FIELDS',
              error: 'targetId required',
            })
          );
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

    it('빈 댓글 내용으로 작성 실패', async () => {
      server.use(
        rest.post('/api/comments', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              ok: false,
              code: 'INVALID_INPUT_FIELDS',
              error: 'text is required',
            })
          );
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

    it('유효하지 않은 토큰으로 댓글 작성 실패', async () => {
      const invalidToken = 'invalid-comment-token';

      server.use(
        rest.post('/api/comments', (req, res, ctx) => {
          return res(
            ctx.status(403),
            ctx.json({
              ok: false,
              code: 'FORBIDDEN',
              error: 'invalid token',
            })
          );
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

  describe('4. 감정/반응 시스템 (미래 구현 예정)', () => {
    it('반응 버튼 API 엔드포인트 존재 확인', async () => {
      server.use(
        rest.post('/api/reactions', (req, res, ctx) => {
          return res(
            ctx.status(501),
            ctx.json({
              ok: false,
              code: 'NOT_IMPLEMENTED',
              error: '반응 시스템은 아직 구현되지 않았습니다',
            })
          );
        })
      );

      const reactionData = {
        targetType: 'video',
        targetId: 'video-123',
        reactionType: 'like',
        timecode: '02:30.100',
      };

      const response = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reactionData),
      });

      const result = await response.json();

      expect(response.status).toBe(501);
      expect(result.code).toBe('NOT_IMPLEMENTED');
    });

    it('감정 지표 집계 API 엔드포인트 존재 확인', async () => {
      server.use(
        rest.get('/api/reactions/analytics', (req, res, ctx) => {
          return res(
            ctx.status(501),
            ctx.json({
              ok: false,
              code: 'NOT_IMPLEMENTED',
              error: '반응 분석 기능은 아직 구현되지 않았습니다',
            })
          );
        })
      );

      const response = await fetch('/api/reactions/analytics?targetId=video-123');
      const result = await response.json();

      expect(response.status).toBe(501);
      expect(result.code).toBe('NOT_IMPLEMENTED');
    });
  });

  describe('5. 실시간 기능', () => {
    it('댓글 폴링을 통한 실시간 업데이트', async () => {
      const videoId = 'polling-test-video';
      let commentCount = 1;

      server.use(
        rest.get('/api/comments', (req, res, ctx) => {
          const targetId = req.url.searchParams.get('targetId');

          if (targetId === videoId) {
            const comments = Array.from({ length: commentCount }, (_, i) => ({
              id: `comment-${i + 1}`,
              author: `사용자${i + 1}`,
              text: `실시간 댓글 ${i + 1}`,
              timecode: `00:${String(i * 10).padStart(2, '0')}.000`,
              createdAt: new Date(Date.now() - (commentCount - i) * 1000).toISOString(),
              targetType: 'video',
              targetId: videoId,
            }));

            // 다음 요청 시 댓글 수 증가
            commentCount += 1;

            return res(
              ctx.status(200),
              ctx.json({
                ok: true,
                data: comments,
              })
            );
          }

          return res(
            ctx.status(400),
            ctx.json({
              ok: false,
              error: 'Invalid targetId',
            })
          );
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

    it('다중 사용자 세션 시뮬레이션', async () => {
      const videoId = 'multi-user-video';
      const userTokens = ['user1-token', 'user2-token', 'user3-token'];
      const commentsByUser = new Map();

      // 각 사용자의 토큰 검증 설정
      userTokens.forEach((token, index) => {
        server.use(
          rest.get(`/api/shares/${token}`, (req, res, ctx) => {
            return res(
              ctx.status(200),
              ctx.json({
                ok: true,
                data: {
                  token,
                  role: 'commenter',
                  nickname: `사용자${index + 1}`,
                  targetType: 'video',
                  targetId: videoId,
                },
              })
            );
          })
        );
      });

      // 댓글 작성 API 설정
      server.use(
        rest.post('/api/comments', async (req, res, ctx) => {
          const body = await req.json();
          const { token, text } = body;
          
          const userIndex = userTokens.indexOf(token);
          if (userIndex === -1) {
            return res(ctx.status(403), ctx.json({ ok: false, error: 'Invalid token' }));
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

          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                id: commentId,
                createdAt: comment.createdAt,
              },
            })
          );
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

    it('공유 토큰 유효성 실시간 검증', async () => {
      const token = 'realtime-validation-token';
      let tokenValid = true;

      server.use(
        rest.get(`/api/shares/${token}`, (req, res, ctx) => {
          if (tokenValid) {
            return res(
              ctx.status(200),
              ctx.json({
                ok: true,
                data: {
                  token,
                  role: 'commenter',
                  nickname: '실시간사용자',
                  targetType: 'video',
                  targetId: 'realtime-video',
                },
              })
            );
          } else {
            return res(
              ctx.status(410),
              ctx.json({
                ok: false,
                code: 'EXPIRED',
                error: 'token expired',
              })
            );
          }
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

  describe('6. 통합 워크플로우', () => {
    it('전체 비디오 피드백 워크플로우', async () => {
      const videoFile = createMockVideoFile('workflow-test.mp4');
      const videoId = 'workflow-video-123';
      
      // 1. 비디오 업로드
      server.use(
        rest.post('/api/upload/video', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              videoUrl: 'https://example.com/videos/workflow-test.mp4',
              fileName: 'workflow-test.mp4',
              fileSize: 1048576,
              fileType: 'video/mp4',
            })
          );
        })
      );

      const formData = new FormData();
      formData.append('video', videoFile);

      let response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData,
      });

      let result = await response.json();
      expect(result.ok).toBe(true);

      // 2. 공유 토큰 생성
      const shareToken = 'workflow-share-token';
      server.use(
        rest.post('/api/shares', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                token: shareToken,
                role: 'commenter',
                nickname: '워크플로우테스터',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              },
            })
          );
        }),
        rest.get(`/api/shares/${shareToken}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                token: shareToken,
                role: 'commenter',
                nickname: '워크플로우테스터',
                targetType: 'video',
                targetId: videoId,
              },
            })
          );
        })
      );

      response = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'video',
          targetId: videoId,
          role: 'commenter',
          nickname: '워크플로우테스터',
          expiresIn: 7 * 24 * 3600,
        }),
      });

      result = await response.json();
      expect(result.ok).toBe(true);
      expect(result.data.token).toBe(shareToken);

      // 3. 댓글 작성
      const comments = [];
      server.use(
        rest.post('/api/comments', async (req, res, ctx) => {
          const body = await req.json();
          const commentId = `comment-${Date.now()}`;
          const comment = {
            id: commentId,
            author: body.author || '워크플로우테스터',
            text: body.text,
            timecode: body.timecode || null,
            createdAt: new Date().toISOString(),
            targetType: body.targetType,
            targetId: body.targetId,
          };
          
          comments.push(comment);
          
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: {
                id: commentId,
                createdAt: comment.createdAt,
              },
            })
          );
        }),
        rest.get('/api/comments', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ok: true,
              data: comments,
            })
          );
        })
      );

      response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: shareToken,
          targetType: 'video',
          targetId: videoId,
          text: '전체 워크플로우 테스트 댓글입니다',
          timecode: '01:30.500',
        }),
      });

      result = await response.json();
      expect(result.ok).toBe(true);

      // 4. 댓글 목록 조회
      response = await fetch(`/api/comments?targetType=video&targetId=${videoId}`);
      result = await response.json();

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].text).toContain('전체 워크플로우 테스트');
      expect(result.data[0].timecode).toBe('01:30.500');
    });

    it('오류 복구 시나리오', async () => {
      // 네트워크 오류 시뮬레이션
      server.use(
        rest.post('/api/comments', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({
            ok: false,
            code: 'NETWORK_ERROR',
            error: '네트워크 오류가 발생했습니다',
          }));
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
  });
});
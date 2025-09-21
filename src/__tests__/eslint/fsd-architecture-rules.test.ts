/**
 * FSD 아키텍처 검증 ESLint 규칙 TDD 테스트
 * CLAUDE.md Part 2: FSD & 클린 아키텍처 경계 검증
 */

import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

describe('ESLint FSD 아키텍처 규칙', () => {
  let eslint: ESLint;

  beforeEach(async () => {
    eslint = new ESLint({
      cwd: projectRoot,
      overrideConfigFile: join(projectRoot, 'eslint.config.mjs'),
    });
  });

  describe('레이어 간 의존성 제어', () => {
    it('상향 의존성을 감지해야 함 (entities → features 금지)', async () => {
      const code = `
        // entities 레이어에서 features 레이어로의 상향 의존성
        import { useVideoProcessing } from '@/features/video-processing';
        import { StoryGenerator } from '@/features/story/generator';

        export const entityWithUpwardDep = () => {
          // 금지된 상향 의존성
        };
      `;

      const results = await eslint.lintText(code, {
        filePath: 'src/entities/video/model/video-entity.ts'
      });
      const errors = results[0].messages;
      const fsdErrors = errors.filter(error =>
        error.message.includes('FSD 위반') ||
        error.message.includes('상향 의존')
      );

      expect(fsdErrors.length).toBeGreaterThanOrEqual(1);
      fsdErrors.forEach(error => {
        expect(error.message).toContain('FSD 위반');
        expect(error.severity).toBe(2); // error level
      });
    });

    it('app 레이어로의 상향 의존성을 감지해야 함', async () => {
      const code = `
        // 하위 레이어에서 app 레이어로의 상향 의존성
        import { AppRouter } from '@/app/router';
        import { globalStore } from '@/app/store';

        export const badImport = () => {
          // 금지된 app 레이어 의존성
        };
      `;

      const results = await eslint.lintText(code, {
        filePath: 'src/features/auth/hooks/useAuth.ts'
      });
      const errors = results[0].messages;
      const fsdErrors = errors.filter(error =>
        error.message.includes('FSD 위반') &&
        error.message.includes('app 레이어')
      );

      expect(fsdErrors.length).toBeGreaterThanOrEqual(1);
      fsdErrors.forEach(error => {
        expect(error.message).toContain('app 레이어로의 상향 의존은 금지');
      });
    });

    it('Internal API 직접 접근을 감지해야 함', async () => {
      const code = `
        // Public API 우회하여 내부 모듈 직접 접근
        import { VideoModel } from '@/entities/video/model/internal';
        import { AuthStore } from '@/entities/auth/store/auth-store';
        import { ApiClient } from '@/entities/user/api/client';

        export const badInternalAccess = () => {
          // 금지된 내부 API 직접 접근
        };
      `;

      const results = await eslint.lintText(code, {
        filePath: 'src/features/video-editor/components/Editor.tsx'
      });
      const errors = results[0].messages;
      const internalApiErrors = errors.filter(error =>
        error.message.includes('FSD 위반') &&
        error.message.includes('내부 모듈')
      );

      expect(internalApiErrors.length).toBeGreaterThanOrEqual(3);
      internalApiErrors.forEach(error => {
        expect(error.message).toContain('Public API');
        expect(error.message).toContain('@/entities/');
      });
    });
  });

  describe('허용된 의존성 패턴', () => {
    it('하향 의존성은 허용해야 함 (features → entities)', async () => {
      const code = `
        // 올바른 하향 의존성
        import { VideoEntity } from '@/entities/video';
        import { UserEntity } from '@/entities/user';
        import { ApiClient } from '@/shared/lib/api';

        export const correctDependency = () => {
          // 허용된 하향 의존성
        };
      `;

      const results = await eslint.lintText(code, {
        filePath: 'src/features/video-processing/hooks/useVideoProcessing.ts'
      });
      const errors = results[0].messages;
      const fsdErrors = errors.filter(error =>
        error.message.includes('FSD 위반')
      );

      expect(fsdErrors).toHaveLength(0);
    });

    it('동일 레벨 Public API 접근은 허용해야 함', async () => {
      const code = `
        // Public API를 통한 올바른 접근
        import { VideoEntity } from '@/entities/video';
        import { UserAuth } from '@/entities/auth';

        export const correctPublicApi = () => {
          // Public API 사용
        };
      `;

      const results = await eslint.lintText(code, {
        filePath: 'src/features/video-editor/components/VideoEditor.tsx'
      });
      const errors = results[0].messages;
      const fsdErrors = errors.filter(error =>
        error.message.includes('FSD 위반')
      );

      expect(fsdErrors).toHaveLength(0);
    });

    it('shared 레이어 접근은 모든 레이어에서 허용해야 함', async () => {
      const code = `
        // shared 레이어는 모든 곳에서 접근 가능
        import { ApiClient } from '@/shared/lib/api';
        import { formatDate } from '@/shared/lib/date';
        import { Button } from '@/shared/ui/button';

        export const sharedAccess = () => {
          // shared 레이어 접근 허용
        };
      `;

      const results = await eslint.lintText(code, {
        filePath: 'src/entities/video/model/video-model.ts'
      });
      const errors = results[0].messages;
      const fsdErrors = errors.filter(error =>
        error.message.includes('FSD 위반')
      );

      expect(fsdErrors).toHaveLength(0);
    });
  });

  describe('레이어별 특수 규칙', () => {
    it('entities 레이어의 순수성을 검증해야 함', async () => {
      const code = `
        // entities는 외부 의존성이 최소화되어야 함
        import { VideoProcessingFeature } from '@/features/video-processing';
        import { VideoPlayer } from '@/widgets/video-player';

        export const impureEntity = () => {
          // entities 순수성 위반
        };
      `;

      const results = await eslint.lintText(code, {
        filePath: 'src/entities/video/model/video-entity.ts'
      });
      const errors = results[0].messages;
      const purityErrors = errors.filter(error =>
        error.message.includes('FSD 위반') &&
        (error.message.includes('features') || error.message.includes('widgets'))
      );

      expect(purityErrors.length).toBeGreaterThanOrEqual(1);
    });

    it('features 레이어의 격리를 검증해야 함', async () => {
      const code = `
        // features 간 직접 의존성 금지
        import { AuthFeature } from '@/features/auth/core';
        import { VideoProcessing } from '@/features/video-processing/lib';

        export const featureCoupling = () => {
          // features 간 결합 금지
        };
      `;

      const results = await eslint.lintText(code, {
        filePath: 'src/features/story-generation/hooks/useStoryGeneration.ts'
      });
      const errors = results[0].messages;
      const isolationErrors = errors.filter(error =>
        error.message.includes('FSD 위반') &&
        error.message.includes('내부 모듈')
      );

      expect(isolationErrors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('에러 메시지 품질', () => {
    it('구체적이고 실행 가능한 에러 메시지를 제공해야 함', async () => {
      const code = `
        import { VideoModel } from '@/entities/video/model/internal-model';
      `;

      const results = await eslint.lintText(code, {
        filePath: 'src/features/video/components/VideoCard.tsx'
      });
      const errors = results[0].messages;

      if (errors.length > 0) {
        const fsdError = errors.find(error => error.message.includes('FSD 위반'));
        if (fsdError) {
          // 에러 메시지가 구체적인 해결책을 제시하는지 확인
          expect(fsdError.message).toContain('Public API');
          expect(fsdError.message).toContain('@/entities/');
          expect(fsdError.message).toMatch(/사용하세요|접근하세요/);
        }
      }
    });
  });
});
/**
 * 스토리 생성 API 스키마 정의
 * Feature-Sliced Design: shared/schemas 레이어
 */

import { z } from 'zod';

/**
 * 스토리 생성 요청 스키마
 * toneAndManner: 문자열 또는 배열 형태 모두 허용 (z.union)
 */
export const StoryGenerationSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(100, '제목은 100자 이하로 입력해주세요'),
  oneLineStory: z.string().min(1, '한 줄 스토리를 입력해주세요').max(200, '한 줄 스토리는 200자 이하로 입력해주세요'),

  // toneAndManner: 배열과 문자열 둘 다 허용하는 union 타입
  toneAndManner: z.union([
    z.string().min(1, '톤앤매너를 선택해주세요'),
    z.array(z.string()).min(1, '톤앤매너를 하나 이상 선택해주세요')
  ]),

  genre: z.string().min(1, '장르를 선택해주세요'),
  target: z.string().min(1, '타겟 관객을 입력해주세요'),
  duration: z.string().default('60초'),
  format: z.string().default('16:9'),
  tempo: z.string().default('보통'),
  developmentMethod: z.string().default('클래식 기승전결'),
  developmentIntensity: z.string().default('보통'),
});

/**
 * 스토리 생성 요청 타입
 */
export type StoryGenerationRequest = z.infer<typeof StoryGenerationSchema>;

/**
 * 정규화된 스토리 생성 요청 타입 (toneAndManner가 항상 문자열)
 */
export type NormalizedStoryGenerationRequest = Omit<StoryGenerationRequest, 'toneAndManner'> & {
  toneAndManner: string;
};
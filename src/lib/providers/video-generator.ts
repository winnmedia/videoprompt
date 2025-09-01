import { createSeedanceVideo, getSeedanceStatus } from './seedance';
import { generateVeoVideo, checkVeoVideoStatus } from './veo';

export type VideoProvider = 'seedance' | 'veo';

export type VideoGenerationOptions = {
  prompt: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  duration?: number;
  provider: VideoProvider; // 필수 선택
  // Veo 전용 옵션
  veoModel?: 'veo-3.0-generate-preview' | 'veo-3.0-fast-generate-preview' | 'veo-2.0-generate-001';
  personGeneration?: 'dont_allow' | 'allow_adult';
  // Seedance 전용 옵션
  seedanceModel?: string;
};

export type VideoGenerationResponse = {
  ok: boolean;
  provider: VideoProvider;
  operationId?: string;
  videoUrl?: string;
  error?: string;
  status?: 'pending' | 'running' | 'succeeded' | 'failed';
  progress?: number;
  estimatedTime?: number; // 예상 완료 시간 (초)
};

// 명시적 provider 선택을 통한 동영상 생성
export async function generateVideo(
  options: VideoGenerationOptions,
): Promise<VideoGenerationResponse> {
  const {
    prompt,
    aspectRatio = '16:9',
    duration = 8,
    provider,
    veoModel = 'veo-3.0-generate-preview',
    personGeneration = 'dont_allow',
    seedanceModel,
  } = options;

  // provider가 명시되지 않은 경우 에러
  if (!provider || (provider !== 'veo' && provider !== 'seedance')) {
    return {
      ok: false,
      provider: 'seedance' as VideoProvider, // 기본값
      error: 'INVALID_PROVIDER: Must specify either "veo" or "seedance"',
    };
  }

  // Veo 선택
  if (provider === 'veo') {
    console.log('DEBUG: Using Veo for video generation');
    const result = await generateVeoVideo({
      prompt,
      aspectRatio,
      duration,
      model: veoModel,
      personGeneration,
    });

    return {
      ...result,
      provider: 'veo' as VideoProvider,
    };
  }

  // Seedance 선택
  if (provider === 'seedance') {
    console.log('DEBUG: Using Seedance for video generation');
    const result = await createSeedanceVideo({
      prompt,
      aspect_ratio: aspectRatio,
      duration_seconds: duration,
      model: seedanceModel,
    });

    return {
      ok: result.ok,
      provider: 'seedance' as VideoProvider,
      operationId: result.jobId,
      error: result.error,
      status: result.status === 'queued' ? 'pending' : (result.status as any),
      progress: 0,
    };
  }

  // 이론적으로 도달할 수 없음
  return {
    ok: false,
    provider: 'seedance' as VideoProvider,
    error: 'UNKNOWN_PROVIDER',
  };
}

// 동영상 상태 확인 (provider 명시 필요)
export async function checkVideoStatus(
  operationId: string,
  provider: VideoProvider,
): Promise<VideoGenerationResponse> {
  if (!provider || (provider !== 'veo' && provider !== 'seedance')) {
    return {
      ok: false,
      provider: 'seedance' as VideoProvider,
      error: 'INVALID_PROVIDER: Must specify either "veo" or "seedance"',
    };
  }

  if (provider === 'veo') {
    const result = await checkVeoVideoStatus(operationId);
    return {
      ...result,
      provider: 'veo' as VideoProvider,
    };
  }

  // Seedance
  const result = await getSeedanceStatus(operationId);
  return {
    ok: result.ok,
    provider: 'seedance' as VideoProvider,
    operationId: result.jobId,
    videoUrl: result.videoUrl,
    error: result.error,
    status: result.status as any,
    progress: result.progress || 0,
  };
}

// provider별 장단점 정보
export function getProviderInfo(provider: VideoProvider) {
  switch (provider) {
    case 'veo':
      return {
        name: 'Google Veo 3',
        advantages: [
          '8초 고화질 동영상 (720p)',
          '오디오 포함',
          '빠른 생성 (11초~6분)',
          '시네마틱 품질',
          '다양한 시각적 스타일 지원',
        ],
        limitations: [
          '지역 제한 (EU, UK, Switzerland, MENA)',
          '2일 후 자동 삭제',
          'AI 워터마킹 (SynthID)',
          '최대 8초 고정 (Veo 3)',
        ],
        bestFor: [
          '고품질 단기 동영상',
          '빠른 프로토타이핑',
          '오디오가 필요한 콘텐츠',
          '시네마틱 스타일',
        ],
      };
    case 'seedance':
      return {
        name: 'Seedance (ModelArk)',
        advantages: [
          '긴 동영상 지원',
          '다양한 모델 선택',
          '안정적인 API',
          '지역 제한 없음',
          '커스터마이징 가능',
        ],
        limitations: [
          '생성 시간이 더 김',
          '오디오 미지원',
          '품질이 Veo보다 낮을 수 있음',
          '더 많은 컴퓨팅 리소스 필요',
        ],
        bestFor: ['긴 동영상', '안정성 중시', '지역 제한이 있는 사용자', '대량 생성'],
      };
    default:
      return {
        name: 'Unknown Provider',
        advantages: [],
        limitations: ['Provider not specified'],
        bestFor: [],
      };
  }
}

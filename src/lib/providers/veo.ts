import { logger } from '@/shared/lib/logger';

export type VeoVideoOptions = {
  prompt: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  duration?: number; // Veo 3는 8초 고정, Veo 2는 2초 고정
  model?: 'veo-3.0-generate-preview' | 'veo-3.0-fast-generate-preview' | 'veo-2.0-generate-001';
  personGeneration?: 'dont_allow' | 'allow_adult';
};

export type VeoVideoResponse = {
  ok: boolean;
  operationId?: string;
  videoUrl?: string;
  error?: string;
  status?: 'pending' | 'running' | 'succeeded' | 'failed';
  progress?: number;
  raw?: any; // API 응답의 원본 데이터를 저장하기 위한 속성
};

// Google Veo 3 API를 통한 동영상 생성
export async function generateVeoVideo(options: VeoVideoOptions): Promise<VeoVideoResponse> {
  // 임시 차단 - VEO3 비용 절감
  logger.info('DEBUG: VEO3 서비스가 일시적으로 비활성화되었습니다.');
  return {
    ok: false,
    error: 'VEO3 서비스가 일시적으로 비활성화되었습니다. 서비스 개선을 위해 잠시 중단된 상태입니다.',
    operationId: undefined,
    videoUrl: undefined
  };

  /* 임시 주석 처리 - 나중에 복구용
  const {
    prompt,
    aspectRatio = '16:9',
    duration = 8,
    model = 'veo-3.0-generate-preview',
    personGeneration = 'dont_allow',
  } = options;

  // 환경변수 확인 및 로깅
  const apiKey =
    process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GOOGLE_API_KEY || process.env.VEO_API_KEY;
  const provider = process.env.VEO_PROVIDER || 'google';

  logger.info('DEBUG: VEO 비디오 생성 시작:', {
    prompt: prompt.slice(0, 100),
    aspectRatio,
    duration,
    model,
    provider,
    hasApiKey: !!apiKey,
    personGeneration,
  });

  if (!apiKey) {
    const error =
      'Google AI Studio API key is not configured. Set GOOGLE_AI_STUDIO_API_KEY environment variable.';
    console.error('DEBUG: VEO API 키 미설정:', error);
    return { ok: false, error };
  }

  try {
    // Google AI Studio VEO API 엔드포인트
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    const modelEndpoint = model || 'veo-3.0-generate-preview';
    const url = `${baseUrl}/${modelEndpoint}:generateContent?key=${apiKey}`;

    // VEO API 요청 본문 구성 (Google AI Studio 공식 스펙에 맞춤)
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    };

    // VEO3 모델별 추가 설정
    if (model.includes('veo-3')) {
      // VEO3는 videoGenerationConfig를 별도로 설정
      (requestBody as any).videoGenerationConfig = {
        aspectRatio: aspectRatio,
        duration: `${duration}s`,
        personGeneration: personGeneration,
      };
    }

    logger.info('DEBUG: VEO 요청 URL:', url);
    logger.info('DEBUG: VEO 요청 본문:', JSON.stringify(requestBody, null, 2));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃 (비디오 생성은 시간이 오래 걸림)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VideoPlanet/1.0',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal as any,
      });

      clearTimeout(timeout);

      logger.info('DEBUG: VEO 응답 상태:', {
        status: response.status,
        statusText: response.statusText,
      });

      // 응답 텍스트를 먼저 가져와서 JSON 파싱 에러 방지
      const responseText = await response.text();
      logger.info('DEBUG: VEO 응답 텍스트 (처음 500자):', responseText.slice(0, 500));

      if (!response.ok) {
        console.error('DEBUG: VEO HTTP 에러:', {
          status: response.status,
          statusText: response.statusText,
        });
        return {
          ok: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          raw: { responseText: responseText.slice(0, 1000) },
        };
      }

      // JSON 파싱 시도
      let jsonResponse: any;
      try {
        jsonResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error('DEBUG: VEO JSON 파싱 에러:', parseError);
        return {
          ok: false,
          error: `Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
          raw: { responseText: responseText.slice(0, 1000) },
        };
      }

      logger.info('DEBUG: VEO 파싱된 응답:', JSON.stringify(jsonResponse, null, 2));

      // VEO API 응답에서 operation ID와 비디오 URL 추출
      const operationId = jsonResponse?.operationId || jsonResponse?.operation?.name;
      const videoUrl = jsonResponse?.videoUrl || jsonResponse?.video?.url;
      const status = jsonResponse?.status || 'processing';
      const progress = jsonResponse?.progress || 0;

      if (!operationId) {
        console.error('DEBUG: VEO operationId 추출 실패:', jsonResponse);
        return {
          ok: false,
          error: 'No operation ID found in response',
          raw: jsonResponse,
        };
      }

      return {
        ok: true,
        operationId,
        videoUrl,
        status,
        progress,
        raw: jsonResponse,
      };
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('DEBUG: VEO 요청 타임아웃');
        return { ok: false, error: 'Request timeout after 60 seconds' };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('DEBUG: VEO 예상치 못한 에러:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      raw: { error: String(error) },
    };
  }
  */
}

// Veo 2 operation 상태 확인 및 동영상 다운로드
export async function checkVeoVideoStatus(operationId: string): Promise<VeoVideoResponse> {
  // 임시 차단 - VEO3 비용 절감
  logger.info('DEBUG: VEO3 상태 확인 서비스가 일시적으로 비활성화되었습니다.');
  return {
    ok: false,
    error: 'VEO3 서비스가 일시적으로 비활성화되었습니다. 서비스 개선을 위해 잠시 중단된 상태입니다.',
    operationId: undefined,
    videoUrl: undefined
  };

  /* 임시 주석 처리 - 나중에 복구용
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: 'GOOGLE_GEMINI_API_KEY not configured',
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1/operations/${operationId}?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      return {
        ok: false,
        error: `Status check error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();

    if (data.done) {
      if (data.error) {
        return {
          ok: false,
          error: `Video generation failed: ${data.error.message || 'unknown error'}`,
        };
      }

      const video = data.response?.generatedVideos?.[0]?.video;
      if (video) {
        return {
          ok: true,
          videoUrl: video.uri || `data:${video.mimeType};base64,${video.data}`,
          status: 'succeeded',
          progress: 100,
        };
      }
    } else {
      // 진행 중
      const progress = data.metadata?.progressPercent || 0;
      return {
        ok: true,
        operationId,
        status: 'running',
        progress,
      };
    }

    return {
      ok: false,
      error: 'Operation not completed or no video data',
    };
  } catch (error) {
    console.error('DEBUG: Veo status check exception:', error);
    return {
      ok: false,
      error: `Status check exception: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
  */
}

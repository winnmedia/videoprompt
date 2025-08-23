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
};

// Google Veo 3 API를 통한 동영상 생성
export async function generateVeoVideo(options: VeoVideoOptions): Promise<VeoVideoResponse> {
  const { 
    prompt, 
    aspectRatio = '16:9', 
    duration = 8, 
    model = 'veo-3.0-generate-preview',
    personGeneration = 'dont_allow'
  } = options;

  // Veo 전용 환경변수 사용
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const veoProvider = process.env.VEO_PROVIDER || 'google';
  const veoModel = process.env.VEO_MODEL || 'veo-3.0-generate-preview';
  
  if (!apiKey) {
    return { 
      ok: false, 
      error: 'GOOGLE_GEMINI_API_KEY not configured' 
    };
  }

  // Veo provider가 비활성화된 경우
  if (veoProvider !== 'google' && veoProvider !== 'enabled') {
    return {
      ok: false,
      error: 'VEO_PROVIDER not enabled. Set VEO_PROVIDER=google or VEO_PROVIDER=enabled'
    };
  }

  try {
    // Veo 3는 8초 고정, Veo 2는 2초 고정
    const actualDuration = model.startsWith('veo-3') ? 8 : 2;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    
    console.log('DEBUG: Veo3 API 호출 시작:', {
      model,
      prompt: prompt.slice(0, 100),
      aspectRatio,
      duration: actualDuration,
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'none',
      url: url.replace(apiKey, '***')
    });

    // Google Veo API 정확한 스펙에 맞춘 요청 바디
    const body = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };

    // Veo 3 API는 별도의 videoGenerationConfig 없이 모델 자체에서 처리
    // 모델명으로 동영상 생성 여부가 결정됨
    console.log('DEBUG: Veo3 요청 바디:', JSON.stringify(body, null, 2));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    console.log('DEBUG: Veo3 API 요청 전송 중...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    console.log('DEBUG: Veo3 API 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      console.error('DEBUG: Veo3 API 오류 응답:', response.status, errorText);
      return {
        ok: false,
        error: `Veo API error: ${response.status} - ${errorText}`
      };
    }

    const data = await response.json();
    console.log('DEBUG: Veo3 API 응답 키:', Object.keys(data));
    console.log('DEBUG: Veo3 API 응답 구조:', JSON.stringify(data, null, 2));

    // Veo 3는 즉시 동영상 반환, Veo 2는 operation 반환
    if (model.startsWith('veo-3')) {
      console.log('DEBUG: Veo3 모델 - 즉시 동영상 반환 시도');
      const video = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (video) {
        console.log('DEBUG: Veo3 동영상 생성 성공:', {
          mimeType: video.mimeType,
          dataLength: video.data ? video.data.length : 0
        });
        return {
          ok: true,
          videoUrl: `data:${video.mimeType};base64,${video.data}`,
          status: 'succeeded',
          progress: 100
        };
      } else {
        console.log('DEBUG: Veo3 응답에서 동영상 데이터를 찾을 수 없음');
      }
    } else {
      // Veo 2: operation ID 반환
      console.log('DEBUG: Veo2 모델 - operation ID 반환 시도');
      const operation = data.operation;
      if (operation?.name) {
        console.log('DEBUG: Veo2 operation 시작:', operation.name);
        return {
          ok: true,
          operationId: operation.name,
          status: 'pending',
          progress: 0
        };
      } else {
        console.log('DEBUG: Veo2 응답에서 operation을 찾을 수 없음');
      }
    }

    console.log('DEBUG: Veo3 API 응답에서 유효한 데이터를 찾을 수 없음');
    return {
      ok: false,
      error: 'No video data or operation ID received'
    };

  } catch (error) {
    console.error('DEBUG: Veo3 API 예외 발생:', error);
    return {
      ok: false,
      error: `Veo API exception: ${error instanceof Error ? error.message : 'unknown error'}`
    };
  }
}

// Veo 2 operation 상태 확인 및 동영상 다운로드
export async function checkVeoVideoStatus(operationId: string): Promise<VeoVideoResponse> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return { 
      ok: false, 
      error: 'GOOGLE_GEMINI_API_KEY not configured' 
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1/operations/${operationId}?key=${encodeURIComponent(apiKey)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      return {
        ok: false,
        error: `Status check error: ${response.status} - ${errorText}`
      };
    }

    const data = await response.json();
    
    if (data.done) {
      if (data.error) {
        return {
          ok: false,
          error: `Video generation failed: ${data.error.message || 'unknown error'}`
        };
      }

      const video = data.response?.generatedVideos?.[0]?.video;
      if (video) {
        return {
          ok: true,
          videoUrl: video.uri || `data:${video.mimeType};base64,${video.data}`,
          status: 'succeeded',
          progress: 100
        };
      }
    } else {
      // 진행 중
      const progress = data.metadata?.progressPercent || 0;
      return {
        ok: true,
        operationId,
        status: 'running',
        progress
      };
    }

    return {
      ok: false,
      error: 'Operation not completed or no video data'
    };

  } catch (error) {
    console.error('DEBUG: Veo status check exception:', error);
    return {
      ok: false,
      error: `Status check exception: ${error instanceof Error ? error.message : 'unknown error'}`
    };
  }
}

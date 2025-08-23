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

    console.log('DEBUG: Veo API request:', { 
      model: veoModel, 
      prompt: prompt.slice(0, 100), 
      aspectRatio, 
      duration: actualDuration,
      provider: veoProvider,
      url: url
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      console.error('DEBUG: Veo API error response:', response.status, errorText);
      return {
        ok: false,
        error: `Veo API error: ${response.status} - ${errorText}`
      };
    }

    const data = await response.json();
    console.log('DEBUG: Veo API response keys:', Object.keys(data));

    // Veo 3는 즉시 동영상 반환, Veo 2는 operation 반환
    if (model.startsWith('veo-3')) {
      const video = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (video) {
        return {
          ok: true,
          videoUrl: `data:${video.mimeType};base64,${video.data}`,
          status: 'succeeded',
          progress: 100
        };
      }
    } else {
      // Veo 2: operation ID 반환
      const operation = data.operation;
      if (operation?.name) {
        return {
          ok: true,
          operationId: operation.name,
          status: 'pending',
          progress: 0
        };
      }
    }

    return {
      ok: false,
      error: 'No video data or operation ID received'
    };

  } catch (error) {
    console.error('DEBUG: Veo API exception:', error);
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

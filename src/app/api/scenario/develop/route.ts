import { NextRequest, NextResponse } from 'next/server';
import { createAIServiceManager } from '@/lib/ai-client';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: '시나리오 프롬프트가 필요합니다.' },
        { status: 400 }
      );
    }

    // AI 서비스 매니저 생성
    const aiManager = createAIServiceManager();
    
    // 1단계: 기본 시나리오 개발
    const developmentResult = await aiManager.generateScenePrompt({
      prompt: prompt.trim(),
      style: '자연스러운',
      aspectRatio: '16:9',
      duration: 5,
      theme: '일반',
      targetAudience: '전체',
      mood: '밝음',
      camera: '와이드',
      weather: '맑음',
    });

    if (!developmentResult.success || !developmentResult.data) {
      throw new Error(developmentResult.error || '시나리오 개발에 실패했습니다.');
    }

    // 2단계: 이미지용 프롬프트 변환
    const imagePromptResult = await aiManager.rewritePromptForImage(
      developmentResult.data.enhancedPrompt,
      'cinematic, photorealistic, high quality, detailed'
    );

    // 3단계: Seedance용 프롬프트 변환
    const seedancePromptResult = await aiManager.rewritePromptForSeedance(
      developmentResult.data.enhancedPrompt,
      '--duration 5 --aspect 16:9 --style cinematic'
    );

    const result = {
      originalPrompt: prompt.trim(),
      enhancedPrompt: developmentResult.data.enhancedPrompt,
      imagePrompt: imagePromptResult || developmentResult.data.enhancedPrompt,
      seedancePrompt: seedancePromptResult || developmentResult.data.enhancedPrompt,
      suggestions: developmentResult.data.suggestions || [],
      metadata: {
        ...developmentResult.data.metadata,
        developmentTimestamp: new Date().toISOString(),
        aiModel: aiManager.getCurrentModel(),
      },
    };

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('시나리오 개발 API 오류:', error);
    
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}







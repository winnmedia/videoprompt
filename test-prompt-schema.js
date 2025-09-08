#!/usr/bin/env node

/**
 * 프롬프트 시스템 JSON 스키마 준수 테스트
 */

const { compilePromptSimple, createEmptyV31Instance } = require('./src/lib/schemas/cinegenius-v3.1-simple');

async function testV31SchemaCompliance() {
  console.log('🧪 CineGenius v3.1 JSON 스키마 준수 테스트 시작');
  console.log('='.repeat(60));

  // 테스트 케이스 1: 기본 빈 인스턴스
  console.log('\n📋 테스트 케이스 1: 기본 빈 인스턴스');
  try {
    const emptyInstance = createEmptyV31Instance();
    console.log('✅ 빈 인스턴스 생성 성공');
    console.log('구조:', JSON.stringify(emptyInstance, null, 2).substring(0, 300) + '...');
  } catch (error) {
    console.log('❌ 빈 인스턴스 생성 실패:', error.message);
  }

  // 테스트 케이스 2: 완전한 프롬프트 데이터로 컴파일 테스트
  console.log('\n📋 테스트 케이스 2: 완전한 프롬프트 컴파일');
  try {
    const fullPromptData = {
      userInput: {
        directPrompt: "A dramatic rooftop scene with two businessmen making a deal",
        projectTitle: "Rooftop Deal Gone Wrong - Full SFX",
        style: ["Cinematic", "Neo-noir", "Night"],
        aspectRatio: "16:9"
      },
      projectConfig: {
        aspectRatio: "16:9",
        duration: 8,
        fps: 24,
        resolution: "1920x1080"
      },
      generationControl: {
        veo3Options: {
          enableVeoOptimization: true,
          includeAudioLayers: true,
          disableTextOverlays: true
        },
        qualitySettings: {
          priorityMode: "quality",
          maxPromptLength: 2000
        }
      },
      aiAnalysis: {
        sceneBreakdown: [
          {
            timestamp: "00:00-00:02",
            description: "Establishing shot of dark rooftop",
            visualElements: ["cityscape", "fog", "red blinking lights"],
            cameraWork: "Static wide shot"
          }
        ],
        audioRequirements: [
          {
            type: "SFX",
            description: "Wind whistling",
            timing: "throughout"
          }
        ]
      },
      finalOutput: {
        compiledPrompt: "",
        keywords: ["cinematic", "rooftop", "business", "noir"],
        negativePrompts: ["blurry", "low quality"],
        technicalSpecs: {
          aspectRatio: "16:9",
          duration: 8,
          style: "cinematic"
        }
      }
    };

    const compilationResult = await compilePromptSimple(fullPromptData, {
      enableVeoOptimization: true,
      includeAudioLayers: true,
      disableTextOverlays: true,
      maxPromptLength: 2000
    });

    console.log('✅ 프롬프트 컴파일 성공');
    console.log('📊 컴파일 결과:');
    console.log('  - 유효성:', compilationResult.validation.isValid ? '✅ 유효' : '❌ 무효');
    console.log('  - 컴파일된 프롬프트 길이:', compilationResult.compiledPrompt.length);
    console.log('  - 최종 프롬프트:', compilationResult.compiledPrompt.substring(0, 200) + '...');
    
    if (!compilationResult.validation.isValid) {
      console.log('  - 에러:', compilationResult.validation.errors);
    }

    // JSON 스키마 구조 검증
    console.log('\n🔍 JSON 구조 분석:');
    console.log('  - userInput:', fullPromptData.userInput ? '✅ 존재' : '❌ 누락');
    console.log('  - projectConfig:', fullPromptData.projectConfig ? '✅ 존재' : '❌ 누락');
    console.log('  - generationControl:', fullPromptData.generationControl ? '✅ 존재' : '❌ 누락');
    console.log('  - aiAnalysis:', fullPromptData.aiAnalysis ? '✅ 존재' : '❌ 누락');
    console.log('  - finalOutput:', fullPromptData.finalOutput ? '✅ 존재' : '❌ 누락');

  } catch (error) {
    console.log('❌ 프롬프트 컴파일 실패:', error.message);
    console.log('스택 트레이스:', error.stack);
  }

  // 테스트 케이스 3: 필수 필드 누락 케이스
  console.log('\n📋 테스트 케이스 3: 필수 필드 누락 검증');
  try {
    const incompleteData = {
      userInput: {
        directPrompt: "Test prompt"
        // projectTitle 누락
      }
    };

    const result = await compilePromptSimple(incompleteData);
    console.log('검증 결과:', result.validation.isValid ? '✅ 통과' : '❌ 실패');
    if (!result.validation.isValid) {
      console.log('검증 오류:', result.validation.errors);
    }
  } catch (error) {
    console.log('❌ 필수 필드 검증 실패:', error.message);
  }

  // 테스트 케이스 4: Veo 3 최적화 옵션 테스트
  console.log('\n📋 테스트 케이스 4: Veo 3 최적화 옵션');
  try {
    const testData = createEmptyV31Instance();
    testData.userInput = {
      directPrompt: "A cinematic shot of a sunset over the ocean",
      projectTitle: "Ocean Sunset",
      style: ["Cinematic"],
      aspectRatio: "16:9"
    };

    const veoOptimizedResult = await compilePromptSimple(testData, {
      enableVeoOptimization: true,
      includeAudioLayers: true,
      disableTextOverlays: true,
      maxPromptLength: 1500
    });

    console.log('✅ Veo 3 최적화 컴파일 완료');
    console.log('  - 최적화 적용:', veoOptimizedResult.compiledPrompt.includes('Veo') ? '✅' : '❌');
    console.log('  - 프롬프트 길이 제한:', veoOptimizedResult.compiledPrompt.length <= 1500 ? '✅' : '❌');
    
  } catch (error) {
    console.log('❌ Veo 3 최적화 실패:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 프롬프트 시스템 JSON 스키마 테스트 완료');
}

// 실행
testV31SchemaCompliance().catch(console.error);
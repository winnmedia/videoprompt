import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/ui/Button';
import { Copy, Check, Sparkles, Download, Eye, EyeOff } from 'lucide-react';
import { 
  type VideoPrompt, 
  type PromptGenerationState,
  type AIResponse 
} from '@/types/video-prompt';
import { cn } from '@/shared/lib/utils';

interface LLMAssistantProps {
  state: PromptGenerationState;
  onGeneratePrompt: () => void;
  onPrevious: () => void;
}

export const LLMAssistant: React.FC<LLMAssistantProps> = ({
  state,
  onGeneratePrompt,
  onPrevious
}) => {
  const [copied, setCopied] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AIResponse | null>(null);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // AI 추천 생성
  const generateAISuggestions = async () => {
    setIsGeneratingSuggestions(true);
    
    try {
      // 실제 구현에서는 API 호출
      // const response = await fetch('/api/generate/suggestions', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(state)
      // });
      // const data = await response.json();
      
      // 임시 데이터 (실제로는 API 응답)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockSuggestions: AIResponse = {
        keywords: [
          'rooftop action',
          'briefcase exchange',
          'sniper ambush',
          'gunfight escape',
          'rain cinematic',
          'helicopter chase',
          'thriller SFX',
          'Veo 3 movie trailer style'
        ],
        negative_prompts: [
          'no blood',
          'no supernatural elements',
          'no text',
          'no daytime or sun',
          'no sci-fi weapons'
        ]
      };
      
      setAiSuggestions(mockSuggestions);
    } catch (error) {
      console.error('AI 추천 생성 실패:', error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  // 최종 프롬프트 생성
  const generateFinalPrompt = (): VideoPrompt => {
    const { metadata, elements, timeline, negative_prompts, keywords } = state;
    
    if (!metadata.prompt_name || !metadata.base_style || !metadata.room_description || !metadata.camera_setup) {
      throw new Error('필수 메타데이터가 누락되었습니다');
    }

    // 키 요소 생성
    const keyElements = [
      ...elements.characters.map(char => char.description),
      ...elements.core_objects.map(obj => obj.description)
    ];

    // 조립된 요소 생성
    const assembledElements = [
      ...elements.characters
        .filter(char => char.reference_image_url)
        .map(char => `${char.description} with reference image`),
      ...elements.core_objects
        .filter(obj => obj.reference_image_url)
        .map(obj => `${obj.description} with reference image`)
    ];

    return {
      metadata: {
        prompt_name: metadata.prompt_name,
        base_style: metadata.base_style,
        aspect_ratio: metadata.aspect_ratio || '16:9',
        room_description: metadata.room_description,
        camera_setup: metadata.camera_setup
      },
      key_elements: keyElements,
      assembled_elements: assembledElements,
      negative_prompts: negative_prompts,
      timeline: timeline,
      text: 'none',
      keywords: keywords
    };
  };

  // 클립보드 복사
  const copyToClipboard = async () => {
    try {
      const finalPrompt = generateFinalPrompt();
      await navigator.clipboard.writeText(JSON.stringify(finalPrompt, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
    }
  };

  // JSON 다운로드
  const downloadJSON = () => {
    try {
      const finalPrompt = generateFinalPrompt();
      const dataStr = JSON.stringify(finalPrompt, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `${state.metadata.prompt_name || 'video-prompt'}.json`;
      link.click();
    } catch (error) {
      console.error('JSON 다운로드 실패:', error);
    }
  };

  // 컴포넌트 마운트 시 AI 추천 자동 생성
  useEffect(() => {
    if (!aiSuggestions) {
      generateAISuggestions();
    }
  }, []);

  const finalPrompt = state.generatedPrompt || generateFinalPrompt();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">
          AI 어시스턴트 및 최종화
        </h1>
        <p className="text-lg text-gray-600">
          AI가 제안한 키워드와 네거티브 프롬프트를 확인하고 최종 프롬프트를 생성하세요
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 왼쪽: AI 추천 */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary-50 to-accent-50 border border-primary-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-6 h-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-gray-900">AI 스마트 추천</h2>
            </div>
            
            {isGeneratingSuggestions ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">AI가 추천을 생성하고 있습니다...</p>
              </div>
            ) : aiSuggestions ? (
              <div className="space-y-4">
                {/* 키워드 */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">추천 키워드</h3>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestions.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 네거티브 프롬프트 */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">네거티브 프롬프트</h3>
                  <div className="space-y-2">
                    {aiSuggestions.negative_prompts.map((prompt, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 bg-danger-50 text-danger-800 rounded-md text-sm"
                      >
                        {prompt}
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={generateAISuggestions}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  추천 새로고침
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">AI 추천을 생성할 수 없습니다</p>
                <Button
                  onClick={generateAISuggestions}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  다시 시도
                </Button>
              </div>
            )}
          </div>

          {/* 프롬프트 생성 버튼 */}
          <div className="bg-success-50 border border-success-200 rounded-lg p-6">
            <h3 className="font-semibold text-success-900 mb-4">최종 프롬프트 생성</h3>
            <p className="text-success-700 text-sm mb-4">
              모든 정보를 종합하여 AI 영상 생성을 위한 최종 프롬프트를 생성합니다.
            </p>
            <Button
              onClick={onGeneratePrompt}
              variant="success"
              size="lg"
              className="w-full"
              loading={state.isGenerating}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              최종 프롬프트 생성
            </Button>
          </div>
        </div>

        {/* 오른쪽: 최종 프롬프트 미리보기 */}
        <div className="space-y-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">최종 프롬프트</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRawData(!showRawData)}
                  leftIcon={showRawData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                >
                  {showRawData ? '구조화된 보기' : '원본 보기'}
                </Button>
              </div>
            </div>

            {state.isGenerating ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">프롬프트를 생성하고 있습니다...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {showRawData ? (
                  /* 원본 JSON 보기 */
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-auto max-h-96">
                    <pre className="text-sm">
                      {JSON.stringify(finalPrompt, null, 2)}
                    </pre>
                  </div>
                ) : (
                  /* 구조화된 보기 */
                  <div className="space-y-4 max-h-96 overflow-auto">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">프로젝트 정보</h4>
                      <div className="bg-white p-3 rounded border">
                        <p><strong>이름:</strong> {finalPrompt.metadata.prompt_name}</p>
                        <p><strong>스타일:</strong> {finalPrompt.metadata.base_style.join(', ')}</p>
                        <p><strong>종횡비:</strong> {finalPrompt.metadata.aspect_ratio}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">장면 설명</h4>
                      <div className="bg-white p-3 rounded border">
                        <p className="text-sm">{finalPrompt.metadata.room_description}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">카메라 설정</h4>
                      <div className="bg-white p-3 rounded border">
                        <p className="text-sm">{finalPrompt.metadata.camera_setup}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">타임라인 ({finalPrompt.timeline.length}개 세그먼트)</h4>
                      <div className="space-y-2">
                        {finalPrompt.timeline.map((segment, index) => (
                          <div key={segment.id} className="bg-white p-3 rounded border">
                            <p className="font-medium text-sm">{segment.timestamp} - {segment.action}</p>
                            <p className="text-xs text-gray-600 mt-1">{segment.audio}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 액션 버튼들 */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    size="sm"
                    leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    className="flex-1"
                  >
                    {copied ? '복사됨!' : '클립보드 복사'}
                  </Button>
                  <Button
                    onClick={downloadJSON}
                    variant="outline"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    className="flex-1"
                  >
                    JSON 다운로드
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="flex justify-between pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-3 text-lg"
        >
          ← 이전 단계
        </Button>
        
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">
            프롬프트 생성이 완료되었습니다!
          </p>
          <p className="text-xs text-gray-500">
            생성된 프롬프트를 복사하거나 다운로드하여 AI 영상 생성 서비스에서 사용하세요
          </p>
        </div>
      </div>
    </div>
  );
};


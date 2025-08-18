'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ScenePrompt } from '@/types/api';
import { createAIServiceManager } from '@/lib/ai-client';

export default function SceneWizardPage() {
  const [scenario, setScenario] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<ScenePrompt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState('일반');
  const [selectedStyle, setSelectedStyle] = useState('자연스러운');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('16:9');
  const [selectedDuration, setSelectedDuration] = useState(2);

  const themes = ['일반', '집', '부엌', '바다', '숲', '도시', '학교', '병원', '사무실', '카페'];
  const styles = ['자연스러운', '드라마틱한', '코믹한', '로맨틱한', '액션', '미스터리', '판타지', 'SF'];
  const aspectRatios = ['16:9', '21:9', '4:3', '1:1', '9:16'];
  const durations = [1, 2, 3, 5, 10];

  const handleGenerate = async () => {
    if (!scenario.trim()) {
      setError('시나리오를 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const aiManager = createAIServiceManager();
      const response = await aiManager.generateScenePrompt({
        prompt: scenario,
        theme: selectedTheme,
        style: selectedStyle,
        aspectRatio: selectedAspectRatio,
        duration: selectedDuration,
      });

      if (response.success && response.data) {
        // 기본 ScenePrompt 구조 생성
        const prompt: ScenePrompt = {
          metadata: {
            prompt_name: `Generated_${Date.now()}`,
            base_style: selectedStyle,
            aspect_ratio: selectedAspectRatio,
            room_description: selectedTheme,
            camera_setup: '기본 설정',
          },
          key_elements: response.data.suggestions || [],
          assembled_elements: [scenario],
          negative_prompts: [],
          timeline: [
            {
              sequence: 1,
              timestamp: `00:00-00:0${selectedDuration}`,
              action: '기본 액션',
              audio: '배경음',
            },
          ],
          text: 'none',
          keywords: response.data.suggestions || [],
        };

        setGeneratedPrompt(prompt);
      } else {
        setError(response.error || 'AI 생성에 실패했습니다.');
      }
    } catch (err) {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedPrompt) return;

    try {
      // TODO: Supabase에 저장 로직 구현
      console.log('Saving prompt:', generatedPrompt);
      alert('프롬프트가 저장되었습니다!');
    } catch (err) {
      setError('저장에 실패했습니다.');
      console.error('Save error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Icon name="wizard" size="lg" className="text-primary-500" />
              <h1 className="text-2xl font-bold text-gray-900">장면 마법사</h1>
            </div>
            <Button variant="outline" onClick={() => window.history.back()}>
              <Icon name="arrow-left" size="sm" className="mr-2" />
              뒤로 가기
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 입력 섹션 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                시나리오 입력
              </h2>
              
              {/* 시나리오 입력 */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  이 곳에 시나리오를 넣어주세요!
                </label>
                <textarea
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  placeholder="예: 아이가 부엌에서 쿠키를 만드는 장면"
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* 설정 옵션들 */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                {/* 테마 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    테마
                  </label>
                  <select
                    value={selectedTheme}
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {themes.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 스타일 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    스타일
                  </label>
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {styles.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 화면비 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    화면비
                  </label>
                  <select
                    value={selectedAspectRatio}
                    onChange={(e) => setSelectedAspectRatio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {aspectRatios.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 지속시간 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    지속시간 (초)
                  </label>
                  <select
                    value={selectedDuration}
                    onChange={(e) => setSelectedDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {durations.map((duration) => (
                      <option key={duration} value={duration}>
                        {duration}초
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 생성 버튼 */}
              <div className="mt-6">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !scenario.trim()}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Icon name="loading" size="sm" className="mr-2 animate-spin" />
                      AI 생성 중...
                    </>
                  ) : (
                    <>
                      <Icon name="wizard" size="sm" className="mr-2" />
                      AI로 장면 생성하기
                    </>
                  )}
                </Button>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* 결과 섹션 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                생성된 장면
              </h2>

              {generatedPrompt ? (
                <div className="space-y-4">
                  {/* 메타데이터 */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">테마:</span>
                      <span className="ml-2 text-gray-900">{generatedPrompt.metadata.room_description}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">스타일:</span>
                      <span className="ml-2 text-gray-900">{generatedPrompt.metadata.base_style}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">화면비:</span>
                      <span className="ml-2 text-gray-900">{generatedPrompt.metadata.aspect_ratio}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">지속시간:</span>
                      <span className="ml-2 text-gray-900">{selectedDuration}초</span>
                    </div>
                  </div>

                  {/* 키워드 */}
                  {generatedPrompt.keywords.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-700 text-sm">키워드:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {generatedPrompt.keywords.map((keyword, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 저장 버튼 */}
                  <div className="pt-4">
                    <Button onClick={handleSave} className="w-full">
                      <Icon name="save" size="sm" className="mr-2" />
                      장면 저장하기
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Icon name="wizard" size="xl" className="mx-auto mb-4 text-gray-300" />
                  <p>시나리오를 입력하고 AI 생성 버튼을 클릭하세요.</p>
                  <p className="text-sm mt-2">AI가 자동으로 장면을 생성해드립니다.</p>
                </div>
              )}
            </div>

            {/* 도움말 */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                💡 사용 팁
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 구체적이고 자세한 설명을 입력하면 더 좋은 결과를 얻을 수 있습니다.</li>
                <li>• 테마와 스타일을 조합하여 원하는 분위기를 연출하세요.</li>
                <li>• 생성된 장면은 프로젝트에 저장하여 나중에 사용할 수 있습니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

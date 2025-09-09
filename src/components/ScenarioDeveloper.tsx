'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/ui';

export interface ScenarioDevelopmentResult {
  originalPrompt: string;
  enhancedPrompt: string;
  imagePrompt: string;
  seedancePrompt: string;
  suggestions: string[];
  metadata: Record<string, any>;
}

interface ScenarioDeveloperProps {
  onDevelopmentComplete: (result: ScenarioDevelopmentResult) => void;
  onError: (error: string) => void;
}

export function ScenarioDeveloper({ onDevelopmentComplete, onError }: ScenarioDeveloperProps) {
  const [scenario, setScenario] = useState('');
  const [isDeveloping, setIsDeveloping] = useState(false);
  const [developmentStep, setDevelopmentStep] = useState<'input' | 'developing' | 'complete'>(
    'input',
  );

  const handleScenarioSubmit = useCallback(async () => {
    if (!scenario.trim()) {
      onError('시나리오를 입력해주세요.');
      return;
    }

    setIsDeveloping(true);
    setDevelopmentStep('developing');

    try {
      // LLM을 통한 시나리오 개발 API 호출
      const response = await fetch('/api/scenario/develop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: scenario.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`시나리오 개발 실패: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setDevelopmentStep('complete');
        onDevelopmentComplete(result.data);
      } else {
        throw new Error(result.error || '연출가가 연출하는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setDevelopmentStep('input');
    } finally {
      setIsDeveloping(false);
    }
  }, [scenario, onDevelopmentComplete, onError]);

  const handleReset = useCallback(() => {
    setScenario('');
    setDevelopmentStep('input');
  }, []);

  if (developmentStep === 'complete') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="check-circle" className="text-green-600" />
          <h3 className="text-lg font-semibold text-green-800">연출 완료!</h3>
        </div>
        <p className="mb-4 text-green-700">
          입력하신 시나리오가 성공적으로 개발되었습니다. 이제 작가가 글을 쓰고 PD가 영상을 제작할 수
          있습니다.
        </p>
        <Button onClick={handleReset} variant="outline">
          새로운 연출 시작
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="scenario" className="mb-2 block text-sm font-medium text-gray-700">
          연출 시나리오 입력
        </label>
        <textarea
          id="scenario"
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="예: 도시의 밤거리를 걷는 한 남자가 우산을 들고 비를 맞으며 걷고 있다"
          className="h-24 w-full resize-none rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          disabled={isDeveloping}
        />
        <p className="mt-1 text-sm text-gray-500">
          간단한 한 줄의 시나리오를 입력하면 연출가가 자세한 프롬프트로 개발합니다.
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleScenarioSubmit}
          disabled={!scenario.trim() || isDeveloping}
          className="flex-1"
        >
          {isDeveloping ? (
            <>
              <Icon name="spinner" className="mr-2 animate-spin" />
              연출가가 연출하는 중...
            </>
          ) : (
            <>
              <Icon name="lightning" className="mr-2" />
              연출 시작하기
            </>
          )}
        </Button>

        {scenario && (
          <Button onClick={handleReset} variant="outline">
            초기화
          </Button>
        )}
      </div>

      {isDeveloping && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <Icon name="spinner" className="animate-spin" />
            <span>연출가가 연출하는 중...</span>
          </div>
        </div>
      )}
    </div>
  );
}

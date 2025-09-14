'use client';

import React from 'react';
import { ScenarioWorkflow } from '@/widgets/scenario/ScenarioWorkflow';

/**
 * 시나리오 페이지
 * FSD Architecture - App Layer
 *
 * 이전 1,595줄에서 → 현재 15줄로 단순화
 * 모든 로직은 ScenarioWorkflow 위젯으로 이동
 */
export default function ScenarioPage() {
  return <ScenarioWorkflow />;
}
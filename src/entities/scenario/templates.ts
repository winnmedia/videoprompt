import { StoryTemplate } from './types';

/**
 * 기본 제공 템플릿 3개
 * FSD Architecture - Entities Layer
 */

export const DEFAULT_TEMPLATES: StoryTemplate[] = [
  {
    id: 'template-advertisement',
    name: '💥 임팩트 광고 영상',
    description: '15-30초 내에 브랜드 메시지를 강력하게 전달하는 광고 영상. 시청자의 주목을 즉시 끌고 행동을 유도합니다.',
    category: 'advertisement',
    thumbnailUrl: '/templates/ad-template.jpg',
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    template: {
      title: '브랜드 광고 영상',
      oneLineStory: '우리 제품/서비스가 고객의 문제를 해결하고 더 나은 삶을 제공합니다',
      toneAndManner: ['임팩트있는', '강렬한', '설득력있는', '자신감있는'],
      genre: '광고',
      target: '잠재 고객',
      duration: '30초',
      format: '16:9',
      tempo: '빠르게',
      developmentMethod: '훅-몰입-반전-떡밥',
      developmentIntensity: '강하게',
    }
  },
  {
    id: 'template-vlog',
    name: '📹 일상 브이로그',
    description: '개인의 하루나 특별한 경험을 자연스럽고 친근하게 공유하는 브이로그. 구독자와의 진정성 있는 소통을 중심으로 합니다.',
    category: 'vlog',
    thumbnailUrl: '/templates/vlog-template.jpg',
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    template: {
      title: '내 일상 브이로그',
      oneLineStory: '평범한 하루 속에서 발견하는 소소한 행복과 특별한 순간들을 공유합니다',
      toneAndManner: ['친근한', '자연스러운', '편안한', '솔직한'],
      genre: '브이로그',
      target: '또래 시청자',
      duration: '5분',
      format: '16:9',
      tempo: '보통',
      developmentMethod: '픽사스토리',
      developmentIntensity: '부드럽게',
    }
  },
  {
    id: 'template-tutorial',
    name: '🎓 실용 튜토리얼',
    description: '단계별로 명확하게 설명하는 교육 영상. 시청자가 따라 하며 실제로 배울 수 있도록 구성된 실용적인 가이드입니다.',
    category: 'tutorial',
    thumbnailUrl: '/templates/tutorial-template.jpg',
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    template: {
      title: '단계별 튜토리얼 가이드',
      oneLineStory: '초보자도 쉽게 따라 할 수 있는 단계별 설명으로 새로운 기술을 마스터하세요',
      toneAndManner: ['전문적인', '명확한', '차근차근한', '도움이되는'],
      genre: '튜토리얼',
      target: '학습자',
      duration: '7분',
      format: '16:9',
      tempo: '느리게',
      developmentMethod: '연역법',
      developmentIntensity: '보통',
    }
  }
];

/**
 * 카테고리별 템플릿 조회
 */
export function getTemplatesByCategory(category: StoryTemplate['category']): StoryTemplate[] {
  return DEFAULT_TEMPLATES.filter(template => template.category === category);
}

/**
 * ID로 템플릿 조회
 */
export function getTemplateById(id: string): StoryTemplate | undefined {
  return DEFAULT_TEMPLATES.find(template => template.id === id);
}

/**
 * 모든 기본 템플릿 조회
 */
export function getAllDefaultTemplates(): StoryTemplate[] {
  return [...DEFAULT_TEMPLATES];
}
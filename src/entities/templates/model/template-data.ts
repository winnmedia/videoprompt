/**
 * 미리 정의된 템플릿 데이터
 *
 * CLAUDE.md 준수사항:
 * - FSD entities 레이어 도메인 데이터
 * - UserJourneyMap.md와 연계된 실용적 템플릿
 * - 다양한 카테고리별 샘플 제공
 */

import type { ProjectTemplate, TemplateTag, CreateTemplateRequest } from '../types'
import { TemplateDomain } from './domain'

/**
 * 공통 태그 정의
 */
export const TEMPLATE_TAGS: Record<string, TemplateTag> = {
  // 스타일 태그
  MODERN: { id: 'modern', name: '모던', color: '#3b82f6', description: '현대적이고 세련된 스타일' },
  CLASSIC: { id: 'classic', name: '클래식', color: '#6b7280', description: '전통적이고 안정적인 스타일' },
  MINIMAL: { id: 'minimal', name: '미니멀', color: '#f3f4f6', description: '깔끔하고 단순한 스타일' },
  CREATIVE: { id: 'creative', name: '창의적', color: '#8b5cf6', description: '독창적이고 예술적인 스타일' },

  // 목적 태그
  SALES: { id: 'sales', name: '판매', color: '#10b981', description: '제품/서비스 판매 목적' },
  EDUCATION: { id: 'education', name: '교육', color: '#f59e0b', description: '교육 및 설명 목적' },
  BRANDING: { id: 'branding', name: '브랜딩', color: '#ef4444', description: '브랜드 인지도 향상' },
  SOCIAL: { id: 'social', name: '소셜미디어', color: '#ec4899', description: '소셜미디어 공유용' },

  // 대상 태그
  B2B: { id: 'b2b', name: 'B2B', color: '#1f2937', description: '기업 대상' },
  B2C: { id: 'b2c', name: 'B2C', description: '일반 소비자 대상', color: '#3b82f6' },
  STARTUP: { id: 'startup', name: '스타트업', color: '#7c3aed', description: '스타트업 기업' },
  ECOMMERCE: { id: 'ecommerce', name: '이커머스', color: '#059669', description: '온라인 쇼핑몰' }
} as const

/**
 * 광고/마케팅 템플릿들
 */
const ADVERTISING_TEMPLATES: CreateTemplateRequest[] = [
  {
    name: '제품 런칭 프로모션',
    description: '새로운 제품을 효과적으로 소개하는 15초 프로모션 영상입니다. 강력한 첫인상과 핵심 기능을 부각시켜 고객의 관심을 끌고 구매 욕구를 자극합니다.',
    shortDescription: '신제품을 임팩트 있게 소개하는 15초 프로모션',
    category: 'advertising',
    difficulty: 'beginner',
    duration: 'short',
    estimatedCompletionTime: 30,
    storySteps: [
      {
        title: '문제 상황 제시',
        content: '일상의 불편함이나 고민을 드라마틱하게 보여주어 시청자의 공감을 이끌어냅니다.',
        duration: 3,
        imagePrompt: 'person looking frustrated or confused in daily situation',
        voiceoverText: '이런 경험 있으시죠?',
        musicMood: 'tense'
      },
      {
        title: '제품 등장',
        content: '해결책으로 제품이 등장하는 순간을 극적으로 연출합니다.',
        duration: 4,
        imagePrompt: 'product reveal with dramatic lighting and elegant presentation',
        voiceoverText: '이제 걱정 끝!',
        musicMood: 'hopeful'
      },
      {
        title: '핵심 기능 시연',
        content: '제품의 핵심 기능을 간결하고 명확하게 시연합니다.',
        duration: 5,
        imagePrompt: 'product demonstration showing key features in action',
        voiceoverText: '간단하고 효과적으로',
        musicMood: 'upbeat'
      },
      {
        title: '행동 유도',
        content: '강력한 CTA로 즉시 행동을 유도합니다.',
        duration: 3,
        imagePrompt: 'call to action with brand logo and contact information',
        voiceoverText: '지금 바로 시작하세요!',
        musicMood: 'energetic'
      }
    ],
    shotSequences: [
      // 1단계 샷들
      { title: '문제 상황 클로즈업', description: '불편함을 겪는 표정', duration: 1, cameraAngle: 'close-up', lighting: 'moody', movement: 'static', visualPrompt: 'frustrated person close-up' },
      { title: '문제 상황 와이드', description: '전체 상황 조망', duration: 1, cameraAngle: 'wide', lighting: 'natural', movement: 'slow zoom', visualPrompt: 'wide shot of problematic situation' },
      { title: '문제 디테일', description: '문제의 구체적 모습', duration: 1, cameraAngle: 'medium', lighting: 'harsh', movement: 'handheld', visualPrompt: 'detailed view of the problem' },

      // 2단계 샷들
      { title: '제품 티저', description: '제품의 일부만 보여주기', duration: 1.5, cameraAngle: 'extreme close-up', lighting: 'dramatic', movement: 'reveal', visualPrompt: 'partial product reveal teaser' },
      { title: '제품 풀샷', description: '제품 전체 모습', duration: 1.5, cameraAngle: 'medium', lighting: 'studio', movement: 'rotating', visualPrompt: 'full product beauty shot' },
      { title: '브랜드 로고', description: '브랜드 아이덴티티', duration: 1, cameraAngle: 'close-up', lighting: 'clean', movement: 'static', visualPrompt: 'brand logo presentation' },

      // 3단계 샷들
      { title: '기능 시연 1', description: '첫 번째 핵심 기능', duration: 2, cameraAngle: 'medium', lighting: 'bright', movement: 'follow', visualPrompt: 'first key feature demonstration' },
      { title: '기능 시연 2', description: '두 번째 핵심 기능', duration: 2, cameraAngle: 'close-up', lighting: 'bright', movement: 'static', visualPrompt: 'second key feature demonstration' },
      { title: '결과 보여주기', description: '사용 후 만족스러운 결과', duration: 1, cameraAngle: 'wide', lighting: 'warm', movement: 'slow zoom', visualPrompt: 'satisfied result after using product' },

      // 4단계 샷들
      { title: 'CTA 메시지', description: '행동 유도 문구', duration: 1, cameraAngle: 'medium', lighting: 'bright', movement: 'static', visualPrompt: 'call to action text overlay' },
      { title: '연락처 정보', description: '구매/문의 방법', duration: 1, cameraAngle: 'close-up', lighting: 'clean', movement: 'static', visualPrompt: 'contact information display' },
      { title: '로고 마무리', description: '브랜드 로고로 마무리', duration: 1, cameraAngle: 'medium', lighting: 'premium', movement: 'fade', visualPrompt: 'final brand logo presentation' }
    ],
    promptConfig: {
      basePrompt: 'Professional product advertisement video, high quality commercial style',
      styleModifiers: ['cinematic lighting', 'sharp focus', 'vibrant colors', 'commercial grade'],
      qualitySettings: {
        resolution: '1920x1080',
        aspectRatio: '16:9',
        frameRate: 30,
        quality: 'high'
      },
      brandingElements: {
        logoPlacement: 'bottom-right',
        colorScheme: ['#3b82f6', '#ffffff', '#1f2937'],
        fontFamily: 'modern-sans'
      }
    },
    tags: ['modern', 'sales', 'b2c'],
    customizableFields: ['productName', 'brandColors', 'contactInfo', 'problemScenario'],
    variationSuggestions: ['Tech Product Version', 'Food & Beverage Version', 'Fashion Version', 'Service Version']
  },

  {
    name: '브랜드 스토리텔링',
    description: '브랜드의 가치와 철학을 감동적인 스토리로 전달하는 60초 영상입니다. 고객과의 정서적 연결을 강화하고 브랜드 충성도를 높입니다.',
    shortDescription: '브랜드 가치를 감동으로 전달하는 스토리',
    category: 'advertising',
    difficulty: 'intermediate',
    duration: 'medium',
    estimatedCompletionTime: 45,
    storySteps: [
      {
        title: '브랜드 기원',
        content: '브랜드가 시작된 배경과 창립자의 철학을 진정성 있게 소개합니다.',
        duration: 15,
        imagePrompt: 'brand founder or origin story with warm, nostalgic atmosphere',
        voiceoverText: '모든 것은 하나의 믿음에서 시작되었습니다.',
        musicMood: 'nostalgic'
      },
      {
        title: '여정과 성장',
        content: '브랜드가 걸어온 길과 극복한 도전들을 보여줍니다.',
        duration: 20,
        imagePrompt: 'journey montage showing growth and challenges overcome',
        voiceoverText: '수많은 도전을 함께 이겨내며',
        musicMood: 'inspiring'
      },
      {
        title: '고객과의 연결',
        content: '브랜드와 고객들의 특별한 순간들을 담습니다.',
        duration: 15,
        imagePrompt: 'customers using products in meaningful life moments',
        voiceoverText: '여러분의 소중한 순간들과 함께했습니다.',
        musicMood: 'emotional'
      },
      {
        title: '미래 비전',
        content: '브랜드가 그려가는 더 나은 미래에 대한 약속을 전합니다.',
        duration: 10,
        imagePrompt: 'future vision with hopeful and bright imagery',
        voiceoverText: '앞으로도 여러분과 함께 새로운 내일을 만들어가겠습니다.',
        musicMood: 'uplifting'
      }
    ],
    shotSequences: [
      { title: '창립자 포트레이트', description: '창립자의 진지한 모습', duration: 4, cameraAngle: 'medium', lighting: 'natural', movement: 'static', visualPrompt: 'founder portrait with natural lighting' },
      { title: '초기 작업 공간', description: '브랜드 시작 당시 모습', duration: 5, cameraAngle: 'wide', lighting: 'warm', movement: 'pan', visualPrompt: 'early workspace or studio' },
      { title: '첫 제품 클로즈업', description: '첫 번째 제품의 디테일', duration: 6, cameraAngle: 'macro', lighting: 'soft', movement: 'dolly', visualPrompt: 'first product close-up details' },

      { title: '성장 타임랩스', description: '성장 과정 압축', duration: 8, cameraAngle: 'various', lighting: 'dynamic', movement: 'timelapse', visualPrompt: 'growth timelapse montage' },
      { title: '팀워크 장면', description: '함께 일하는 모습', duration: 6, cameraAngle: 'medium', lighting: 'bright', movement: 'tracking', visualPrompt: 'team collaboration moments' },
      { title: '도전 극복', description: '어려움 이겨내는 모습', duration: 6, cameraAngle: 'close-up', lighting: 'dramatic', movement: 'push-in', visualPrompt: 'overcoming challenges scene' },

      { title: '고객 미소', description: '만족한 고객들', duration: 5, cameraAngle: 'medium', lighting: 'warm', movement: 'static', visualPrompt: 'satisfied customers smiling' },
      { title: '제품 사용 장면', description: '일상 속 제품 사용', duration: 5, cameraAngle: 'wide', lighting: 'natural', movement: 'follow', visualPrompt: 'product being used in daily life' },
      { title: '감동의 순간', description: '특별한 순간들', duration: 5, cameraAngle: 'close-up', lighting: 'golden', movement: 'slow-motion', visualPrompt: 'emotional moments with product' },

      { title: '미래 비전 이미지', description: '밝은 미래 전망', duration: 4, cameraAngle: 'wide', lighting: 'bright', movement: 'rising', visualPrompt: 'bright future vision imagery' },
      { title: '브랜드 심볼', description: '브랜드 상징 요소', duration: 3, cameraAngle: 'medium', lighting: 'clean', movement: 'static', visualPrompt: 'brand symbol or logo' },
      { title: '메시지 마무리', description: '핵심 메시지 전달', duration: 3, cameraAngle: 'medium', lighting: 'premium', movement: 'fade', visualPrompt: 'final brand message' }
    ],
    promptConfig: {
      basePrompt: 'Emotional brand storytelling video, documentary style with cinematic quality',
      styleModifiers: ['warm tones', 'natural lighting', 'emotional depth', 'authentic moments'],
      qualitySettings: {
        resolution: '1920x1080',
        aspectRatio: '16:9',
        frameRate: 24,
        quality: 'ultra'
      },
      brandingElements: {
        logoPlacement: 'subtle-integration',
        colorScheme: ['warm-neutral-palette'],
        fontFamily: 'elegant-serif'
      }
    },
    tags: ['creative', 'branding', 'b2c'],
    customizableFields: ['brandStory', 'founderName', 'keyMilestones', 'brandValues'],
    variationSuggestions: ['Startup Story', 'Family Business', 'Social Impact', 'Innovation Focus']
  }
]

/**
 * 교육/튜토리얼 템플릿들
 */
const EDUCATION_TEMPLATES: CreateTemplateRequest[] = [
  {
    name: '단계별 튜토리얼',
    description: '복잡한 과정을 쉽고 명확하게 설명하는 교육용 영상입니다. 시청자가 따라하기 쉽도록 단계별로 구성되어 있습니다.',
    shortDescription: '따라하기 쉬운 단계별 가이드',
    category: 'education',
    difficulty: 'beginner',
    duration: 'medium',
    estimatedCompletionTime: 40,
    storySteps: [
      {
        title: '목표 제시',
        content: '이 튜토리얼을 통해 달성할 수 있는 목표를 명확히 제시합니다.',
        duration: 10,
        imagePrompt: 'clear goal or end result presentation',
        voiceoverText: '오늘 이것을 배워보겠습니다.',
        musicMood: 'informative'
      },
      {
        title: '준비물 소개',
        content: '필요한 도구나 재료들을 체계적으로 소개합니다.',
        duration: 15,
        imagePrompt: 'organized tools and materials layout',
        voiceoverText: '먼저 이것들을 준비해주세요.',
        musicMood: 'neutral'
      },
      {
        title: '단계별 실행',
        content: '핵심 과정을 단계별로 천천히 시연합니다.',
        duration: 25,
        imagePrompt: 'step by step demonstration with clear hand movements',
        voiceoverText: '이제 단계별로 따라해보겠습니다.',
        musicMood: 'focused'
      },
      {
        title: '완성 및 팁',
        content: '완성된 결과물을 보여주고 유용한 팁을 제공합니다.',
        duration: 10,
        imagePrompt: 'finished result with additional tips overlay',
        voiceoverText: '완성입니다! 추가 팁도 확인해보세요.',
        musicMood: 'success'
      }
    ],
    shotSequences: [
      { title: '목표 전체 샷', description: '최종 결과물 전체 모습', duration: 4, cameraAngle: 'wide', lighting: 'bright', movement: 'static', visualPrompt: 'final result wide shot' },
      { title: '목표 디테일', description: '결과물의 세부 사항', duration: 3, cameraAngle: 'close-up', lighting: 'clean', movement: 'slow-zoom', visualPrompt: 'final result detail close-up' },
      { title: '목표 설명', description: '목표에 대한 설명', duration: 3, cameraAngle: 'medium', lighting: 'neutral', movement: 'static', visualPrompt: 'instructor explaining goal' },

      { title: '준비물 레이아웃', description: '모든 준비물 배치', duration: 5, cameraAngle: 'top-down', lighting: 'even', movement: 'static', visualPrompt: 'organized materials top view' },
      { title: '도구별 소개', description: '각 도구 개별 소개', duration: 5, cameraAngle: 'close-up', lighting: 'clear', movement: 'pan', visualPrompt: 'individual tool introductions' },
      { title: '재료 확인', description: '재료 상태 확인', duration: 5, cameraAngle: 'medium', lighting: 'natural', movement: 'static', visualPrompt: 'material quality check' },

      { title: '1단계 시연', description: '첫 번째 단계 실행', duration: 8, cameraAngle: 'medium', lighting: 'clear', movement: 'follow', visualPrompt: 'step 1 demonstration' },
      { title: '2단계 시연', description: '두 번째 단계 실행', duration: 8, cameraAngle: 'close-up', lighting: 'focused', movement: 'static', visualPrompt: 'step 2 demonstration' },
      { title: '3단계 시연', description: '세 번째 단계 실행', duration: 9, cameraAngle: 'various', lighting: 'optimal', movement: 'dynamic', visualPrompt: 'step 3 demonstration' },

      { title: '완성품 전시', description: '최종 완성품 소개', duration: 4, cameraAngle: 'beauty', lighting: 'showcase', movement: 'reveal', visualPrompt: 'finished product showcase' },
      { title: '유용한 팁', description: '추가 팁 제공', duration: 3, cameraAngle: 'split', lighting: 'comparative', movement: 'static', visualPrompt: 'helpful tips comparison' },
      { title: '마무리 메시지', description: '격려 및 마무리', duration: 3, cameraAngle: 'medium', lighting: 'warm', movement: 'static', visualPrompt: 'encouraging closing message' }
    ],
    promptConfig: {
      basePrompt: 'Educational tutorial video, clear and instructional style',
      styleModifiers: ['bright lighting', 'clear focus', 'educational tone', 'step-by-step clarity'],
      qualitySettings: {
        resolution: '1920x1080',
        aspectRatio: '16:9',
        frameRate: 30,
        quality: 'high'
      }
    },
    tags: ['education', 'minimal', 'b2c'],
    customizableFields: ['tutorialTopic', 'toolsList', 'difficultyLevel', 'timeEstimate'],
    variationSuggestions: ['Cooking Recipe', 'DIY Craft', 'Software Tutorial', 'Fitness Routine']
  }
]

/**
 * 엔터테인먼트 템플릿들
 */
const ENTERTAINMENT_TEMPLATES: CreateTemplateRequest[] = [
  {
    name: '숏폼 코미디',
    description: '15초 안에 웃음을 선사하는 숏폼 코미디 영상입니다. SNS에서 바이럴될 수 있는 재미있는 구성으로 제작됩니다.',
    shortDescription: '15초 바이럴 코미디 콘텐츠',
    category: 'entertainment',
    difficulty: 'intermediate',
    duration: 'short',
    estimatedCompletionTime: 35,
    storySteps: [
      {
        title: '상황 설정',
        content: '일상적이지만 특별한 상황을 설정하여 시청자의 관심을 끕니다.',
        duration: 3,
        imagePrompt: 'ordinary situation with potential for comedy',
        voiceoverText: '',
        musicMood: 'neutral'
      },
      {
        title: '반전 준비',
        content: '예상치 못한 반전을 위한 복선을 깔아둡니다.',
        duration: 4,
        imagePrompt: 'subtle setup for unexpected twist',
        voiceoverText: '',
        musicMood: 'building'
      },
      {
        title: '코미디 클라이맥스',
        content: '예상을 뒤엎는 재미있는 반전이 일어납니다.',
        duration: 5,
        imagePrompt: 'unexpected comedy moment with exaggerated reaction',
        voiceoverText: '',
        musicMood: 'comedy'
      },
      {
        title: '펀치라인',
        content: '웃음을 확실히 만드는 마지막 포인트를 제공합니다.',
        duration: 3,
        imagePrompt: 'final punchline moment with clear comedy payoff',
        voiceoverText: '',
        musicMood: 'comedy-peak'
      }
    ],
    shotSequences: [
      { title: '일상 장면 설정', description: '평범한 일상 상황', duration: 1.5, cameraAngle: 'wide', lighting: 'natural', movement: 'static', visualPrompt: 'normal daily situation' },
      { title: '캐릭터 등장', description: '주인공 캐릭터 소개', duration: 1, cameraAngle: 'medium', lighting: 'clear', movement: 'reveal', visualPrompt: 'main character introduction' },
      { title: '상황 디테일', description: '상황의 구체적 모습', duration: 0.5, cameraAngle: 'close-up', lighting: 'focused', movement: 'push-in', visualPrompt: 'situation detail focus' },

      { title: '복선 힌트', description: '반전 준비 신호', duration: 1.5, cameraAngle: 'medium', lighting: 'subtle', movement: 'slight-zoom', visualPrompt: 'subtle comedy setup hint' },
      { title: '캐릭터 반응', description: '캐릭터의 표정 변화', duration: 1.5, cameraAngle: 'close-up', lighting: 'expressive', movement: 'static', visualPrompt: 'character expression change' },
      { title: '긴장감 조성', description: '무언가 일어날 분위기', duration: 1, cameraAngle: 'various', lighting: 'building', movement: 'dynamic', visualPrompt: 'tension building moment' },

      { title: '반전 시작', description: '예상 밖의 일이 시작', duration: 2, cameraAngle: 'wide', lighting: 'dramatic', movement: 'quick-zoom', visualPrompt: 'unexpected event begins' },
      { title: '반전 절정', description: '반전의 핵심 순간', duration: 2, cameraAngle: 'close-up', lighting: 'highlight', movement: 'static', visualPrompt: 'comedy climax moment' },
      { title: '놀란 반응', description: '예상 못한 반응들', duration: 1, cameraAngle: 'reaction', lighting: 'clear', movement: 'quick-cut', visualPrompt: 'surprised reactions' },

      { title: '펀치라인 전달', description: '마지막 웃음 포인트', duration: 1.5, cameraAngle: 'medium', lighting: 'bright', movement: 'static', visualPrompt: 'final punchline delivery' },
      { title: '여운 장면', description: '웃음의 여운', duration: 1, cameraAngle: 'wide', lighting: 'natural', movement: 'fade', visualPrompt: 'comedy aftermath' },
      { title: '마무리 컷', description: '깔끔한 마무리', duration: 0.5, cameraAngle: 'creative', lighting: 'signature', movement: 'freeze', visualPrompt: 'memorable ending frame' }
    ],
    promptConfig: {
      basePrompt: 'Short form comedy video, viral social media style',
      styleModifiers: ['dynamic editing', 'expressive reactions', 'viral potential', 'mobile-friendly'],
      qualitySettings: {
        resolution: '1080x1920',
        aspectRatio: '9:16',
        frameRate: 30,
        quality: 'high'
      }
    },
    tags: ['creative', 'social', 'b2c'],
    customizableFields: ['comedyStyle', 'characters', 'setting', 'punchline'],
    variationSuggestions: ['Office Comedy', 'Pet Comedy', 'Food Comedy', 'Tech Comedy']
  }
]

/**
 * 모든 템플릿 데이터를 통합
 */
const ALL_TEMPLATE_REQUESTS: CreateTemplateRequest[] = [
  ...ADVERTISING_TEMPLATES,
  ...EDUCATION_TEMPLATES,
  ...ENTERTAINMENT_TEMPLATES
]

/**
 * 템플릿 데이터를 실제 ProjectTemplate 객체로 변환
 */
export const PREDEFINED_TEMPLATES: ProjectTemplate[] = ALL_TEMPLATE_REQUESTS.map(request => {
  const template = TemplateDomain.createTemplate(request)

  // 상태를 published로 변경하고 태그 추가
  return {
    ...template,
    status: 'published',
    tags: request.tags?.map(tagId => TEMPLATE_TAGS[tagId.toUpperCase()]).filter(Boolean) || [],
    metadata: {
      ...template.metadata,
      usage: {
        downloadCount: Math.floor(Math.random() * 100) + 10,
        likeCount: Math.floor(Math.random() * 50) + 5,
        viewCount: Math.floor(Math.random() * 500) + 50,
        forkCount: Math.floor(Math.random() * 20)
      }
    }
  }
})

/**
 * 카테고리별 템플릿 그룹
 */
export const TEMPLATES_BY_CATEGORY = {
  advertising: PREDEFINED_TEMPLATES.filter(t => t.category === 'advertising'),
  education: PREDEFINED_TEMPLATES.filter(t => t.category === 'education'),
  entertainment: PREDEFINED_TEMPLATES.filter(t => t.category === 'entertainment'),
  business: PREDEFINED_TEMPLATES.filter(t => t.category === 'business'),
  social: PREDEFINED_TEMPLATES.filter(t => t.category === 'social'),
  product: PREDEFINED_TEMPLATES.filter(t => t.category === 'product'),
  storytelling: PREDEFINED_TEMPLATES.filter(t => t.category === 'storytelling'),
  tutorial: PREDEFINED_TEMPLATES.filter(t => t.category === 'tutorial')
} as const

/**
 * 인기 템플릿 (다운로드 수 기준)
 */
export const POPULAR_TEMPLATES = PREDEFINED_TEMPLATES
  .sort((a, b) => b.metadata.usage.downloadCount - a.metadata.usage.downloadCount)
  .slice(0, 6)

/**
 * 추천 템플릿 (신규 사용자용)
 */
export const RECOMMENDED_FOR_BEGINNERS = PREDEFINED_TEMPLATES
  .filter(t => t.difficulty === 'beginner')
  .slice(0, 4)

/**
 * 최신 템플릿
 */
export const LATEST_TEMPLATES = PREDEFINED_TEMPLATES
  .sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
  .slice(0, 6)
/**
 * Templates 시드 데이터 삽입 스크립트
 * Supabase templates 테이블에 초기 템플릿 데이터를 삽입합니다.
 */

import { supabaseAdmin } from '../src/lib/supabase';

// 시드 템플릿 데이터 정의
const SEED_TEMPLATES = [
  // Business Category
  {
    title: 'Corporate Presentation Template',
    description: '기업 프레젠테이션을 위한 전문적이고 신뢰감 있는 템플릿',
    category: 'business',
    tags: ['corporate', 'professional', 'presentation', 'formal'],
    scenario: {
      genre: 'Corporate',
      tone: 'Professional',
      target: 'Business Executives',
      structure: ['Introduction', 'Problem Statement', 'Solution', 'Benefits', 'Call to Action'],
      format: 'Presentation'
    },
    prompt: {
      visualStyle: 'Clean and modern corporate style',
      mood: 'Professional and trustworthy',
      quality: 'High-end business quality',
      keywords: ['corporate', 'professional', 'clean', 'modern', 'trustworthy']
    },
    is_public: true,
    user_id: 'system-planning'
  },
  {
    title: 'Product Launch Campaign',
    description: '신제품 런칭을 위한 마케팅 캠페인 템플릿',
    category: 'business',
    tags: ['product-launch', 'marketing', 'campaign', 'sales'],
    scenario: {
      genre: 'Marketing',
      tone: 'Exciting',
      target: 'Potential Customers',
      structure: ['Product Reveal', 'Key Features', 'Benefits', 'Testimonials', 'Purchase CTA'],
      format: 'Marketing Video'
    },
    prompt: {
      visualStyle: 'Dynamic and energetic with modern graphics',
      mood: 'Exciting and compelling',
      quality: 'Commercial grade',
      keywords: ['dynamic', 'energetic', 'modern', 'exciting', 'product']
    },
    is_public: true,
    user_id: 'system-planning'
  },

  // Education Category
  {
    title: 'Online Course Introduction',
    description: '온라인 강의 소개 영상을 위한 교육적이고 친근한 템플릿',
    category: 'education',
    tags: ['course', 'education', 'learning', 'instructor'],
    scenario: {
      genre: 'Educational',
      tone: 'Friendly',
      target: 'Students',
      structure: ['Welcome', 'Course Overview', 'Learning Objectives', 'What You\'ll Gain', 'Get Started'],
      format: 'Educational Video'
    },
    prompt: {
      visualStyle: 'Warm and inviting educational style',
      mood: 'Encouraging and supportive',
      quality: 'Educational standard',
      keywords: ['educational', 'friendly', 'warm', 'encouraging', 'learning']
    },
    is_public: true,
    user_id: 'system-planning'
  },
  {
    title: 'Scientific Explanation Video',
    description: '복잡한 과학 개념을 쉽게 설명하는 교육 영상 템플릿',
    category: 'education',
    tags: ['science', 'explanation', 'educational', 'animated'],
    scenario: {
      genre: 'Educational',
      tone: 'Informative',
      target: 'General Audience',
      structure: ['Hook Question', 'Basic Concept', 'Detailed Explanation', 'Real-world Examples', 'Summary'],
      format: 'Explainer Video'
    },
    prompt: {
      visualStyle: 'Clean scientific illustration style',
      mood: 'Clear and informative',
      quality: 'Educational documentary',
      keywords: ['scientific', 'clear', 'informative', 'animated', 'explanatory']
    },
    is_public: true,
    user_id: 'system-planning'
  },

  // Entertainment Category
  {
    title: 'Comedy Sketch Template',
    description: '유머러스한 코미디 영상을 위한 재미있고 경쾌한 템플릿',
    category: 'entertainment',
    tags: ['comedy', 'humor', 'sketch', 'funny'],
    scenario: {
      genre: 'Comedy',
      tone: 'Humorous',
      target: 'General Entertainment Audience',
      structure: ['Setup', 'Build-up', 'Punchline', 'Callback', 'Outro'],
      format: 'Comedy Sketch'
    },
    prompt: {
      visualStyle: 'Colorful and playful cartoon style',
      mood: 'Light-hearted and fun',
      quality: 'Entertainment standard',
      keywords: ['colorful', 'playful', 'funny', 'light-hearted', 'entertaining']
    },
    is_public: true,
    user_id: 'system-planning'
  },
  {
    title: 'Movie Trailer Style',
    description: '영화 예고편 스타일의 드라마틱하고 임팩트 있는 템플릿',
    category: 'entertainment',
    tags: ['trailer', 'cinematic', 'dramatic', 'epic'],
    scenario: {
      genre: 'Cinematic',
      tone: 'Dramatic',
      target: 'Movie Enthusiasts',
      structure: ['Opening Hook', 'Character Introduction', 'Conflict', 'Action Montage', 'Climax Tease'],
      format: 'Trailer'
    },
    prompt: {
      visualStyle: 'Cinematic with dramatic lighting',
      mood: 'Epic and thrilling',
      quality: 'Hollywood production',
      keywords: ['cinematic', 'dramatic', 'epic', 'thrilling', 'blockbuster']
    },
    is_public: true,
    user_id: 'system-planning'
  },

  // Marketing Category
  {
    title: 'Social Media Advertisement',
    description: '소셜 미디어 광고를 위한 짧고 강렬한 마케팅 템플릿',
    category: 'marketing',
    tags: ['social-media', 'advertisement', 'short-form', 'viral'],
    scenario: {
      genre: 'Advertising',
      tone: 'Persuasive',
      target: 'Social Media Users',
      structure: ['Attention Grabber', 'Problem', 'Solution', 'Social Proof', 'CTA'],
      format: 'Social Ad'
    },
    prompt: {
      visualStyle: 'Trendy and vibrant social media style',
      mood: 'Energetic and persuasive',
      quality: 'Social media optimized',
      keywords: ['trendy', 'vibrant', 'energetic', 'social', 'viral']
    },
    is_public: true,
    user_id: 'system-planning'
  },
  {
    title: 'Brand Storytelling',
    description: '브랜드 스토리텔링을 위한 감성적이고 진정성 있는 템플릿',
    category: 'marketing',
    tags: ['brand', 'storytelling', 'emotional', 'authentic'],
    scenario: {
      genre: 'Brand Story',
      tone: 'Authentic',
      target: 'Brand Consumers',
      structure: ['Brand Origin', 'Values', 'Mission', 'Impact', 'Community'],
      format: 'Brand Video'
    },
    prompt: {
      visualStyle: 'Authentic and warm documentary style',
      mood: 'Inspiring and genuine',
      quality: 'Brand documentary',
      keywords: ['authentic', 'warm', 'inspiring', 'genuine', 'heartfelt']
    },
    is_public: true,
    user_id: 'system-planning'
  },

  // Social Category
  {
    title: 'Personal Vlog Template',
    description: '개인 브이로그를 위한 친근하고 자연스러운 템플릿',
    category: 'social',
    tags: ['vlog', 'personal', 'lifestyle', 'daily'],
    scenario: {
      genre: 'Lifestyle',
      tone: 'Casual',
      target: 'Social Media Followers',
      structure: ['Daily Greeting', 'Day Activities', 'Personal Thoughts', 'Interactions', 'Wrap-up'],
      format: 'Vlog'
    },
    prompt: {
      visualStyle: 'Natural and candid documentary style',
      mood: 'Casual and relatable',
      quality: 'Personal content',
      keywords: ['natural', 'candid', 'casual', 'relatable', 'personal']
    },
    is_public: true,
    user_id: 'system-planning'
  },
  {
    title: 'Community Event Coverage',
    description: '커뮤니티 행사나 이벤트 커버리지를 위한 활기찬 템플릿',
    category: 'social',
    tags: ['event', 'community', 'celebration', 'gathering'],
    scenario: {
      genre: 'Event Coverage',
      tone: 'Celebratory',
      target: 'Community Members',
      structure: ['Event Opening', 'Highlights', 'Participant Interviews', 'Key Moments', 'Closing'],
      format: 'Event Video'
    },
    prompt: {
      visualStyle: 'Vibrant and celebratory event style',
      mood: 'Joyful and communal',
      quality: 'Event documentation',
      keywords: ['vibrant', 'celebratory', 'joyful', 'communal', 'festive']
    },
    is_public: true,
    user_id: 'system-planning'
  },

  // Creative Category
  {
    title: 'Art Process Documentation',
    description: '예술 작품 제작 과정을 담은 창의적이고 영감을 주는 템플릿',
    category: 'creative',
    tags: ['art', 'process', 'creative', 'inspiration'],
    scenario: {
      genre: 'Creative Process',
      tone: 'Inspiring',
      target: 'Artists and Creatives',
      structure: ['Inspiration', 'Initial Sketch', 'Development', 'Techniques', 'Final Reveal'],
      format: 'Process Video'
    },
    prompt: {
      visualStyle: 'Artistic and creative documentary style',
      mood: 'Inspiring and meditative',
      quality: 'Artistic documentation',
      keywords: ['artistic', 'creative', 'inspiring', 'meditative', 'process']
    },
    is_public: true,
    user_id: 'system-planning'
  },
  {
    title: 'Music Video Concept',
    description: '음악 비디오를 위한 창의적이고 시각적으로 임팩트 있는 템플릿',
    category: 'creative',
    tags: ['music', 'video', 'artistic', 'visual'],
    scenario: {
      genre: 'Music Video',
      tone: 'Artistic',
      target: 'Music Lovers',
      structure: ['Visual Hook', 'Verse Visuals', 'Chorus Impact', 'Bridge Transition', 'Outro'],
      format: 'Music Video'
    },
    prompt: {
      visualStyle: 'Stylized and artistic music video style',
      mood: 'Creative and expressive',
      quality: 'Music video production',
      keywords: ['stylized', 'artistic', 'creative', 'expressive', 'musical']
    },
    is_public: true,
    user_id: 'system-planning'
  }
];

/**
 * 시드 데이터 삽입 실행 함수
 */
async function insertSeedTemplates() {
  console.log('🌱 Templates 시드 데이터 삽입 시작...');

  if (!supabaseAdmin) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }

  try {
    // 기존 시드 데이터 확인
    const { data: existingTemplates, error: checkError } = await supabaseAdmin
      .from('templates')
      .select('id, title')
      .eq('user_id', 'system-planning');

    if (checkError) {
      console.error('❌ 기존 템플릿 확인 실패:', checkError.message);
      process.exit(1);
    }

    console.log(`📋 기존 시드 템플릿: ${existingTemplates?.length || 0}개`);

    // 새로운 템플릿만 필터링
    const existingTitles = new Set(existingTemplates?.map(t => t.title) || []);
    const newTemplates = SEED_TEMPLATES.filter(template =>
      !existingTitles.has(template.title)
    );

    if (newTemplates.length === 0) {
      console.log('✅ 모든 시드 템플릿이 이미 존재합니다.');
      return;
    }

    console.log(`📦 새로운 템플릿 ${newTemplates.length}개 삽입 중...`);

    // 배치 삽입
    const { data, error } = await supabaseAdmin
      .from('templates')
      .insert(newTemplates)
      .select('id, title, category');

    if (error) {
      console.error('❌ 템플릿 삽입 실패:', error.message);
      console.error('상세 오류:', error);
      process.exit(1);
    }

    console.log('✅ 템플릿 삽입 성공!');
    console.log(`📊 삽입된 템플릿: ${data?.length}개`);

    // 카테고리별 통계 출력
    const categoryCounts = data?.reduce((acc, template) => {
      acc[template.category] = (acc[template.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n📈 카테고리별 삽입 통계:');
    Object.entries(categoryCounts || {}).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}개`);
    });

    // 최종 검증
    const { data: finalCount, error: countError } = await supabaseAdmin
      .from('templates')
      .select('count()', { count: 'exact' })
      .eq('is_public', true);

    if (!countError) {
      console.log(`\n🎯 총 Public 템플릿: ${finalCount?.[0]?.count || 0}개`);
    }

    console.log('\n🎉 Templates 시드 데이터 삽입 완료!');

  } catch (error) {
    console.error('❌ 시드 데이터 삽입 중 오류:', error);
    process.exit(1);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  insertSeedTemplates();
}

export { insertSeedTemplates, SEED_TEMPLATES };
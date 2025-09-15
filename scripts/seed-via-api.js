/**
 * API를 통한 Templates 시드 데이터 삽입
 * Supabase 직접 연결 대신 REST API를 사용
 */

const BASE_URL = 'http://localhost:3001';

// 시드 템플릿 데이터
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
    }
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
    }
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
    }
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
    }
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
    }
  }
];

/**
 * 시드 데이터를 API로 삽입
 */
async function seedTemplatesViaAPI() {
  console.log('🌱 Templates 시드 데이터 삽입 시작 (API 방식)...');

  try {
    // 기존 템플릿 확인
    console.log('📋 기존 템플릿 확인 중...');
    const response = await fetch(`${BASE_URL}/api/templates`);

    if (!response.ok) {
      console.log(`⚠️ 기존 템플릿 확인 실패 (${response.status}): ${response.statusText}`);
      console.log('💡 빈 테이블로 간주하고 계속 진행...');
    }

    const existingData = response.ok ? await response.json() : { templates: [] };
    const existingTitles = new Set(existingData.templates?.map(t => t.title) || []);

    console.log(`📊 기존 템플릿: ${existingData.templates?.length || 0}개`);

    // 새로운 템플릿만 필터링
    const newTemplates = SEED_TEMPLATES.filter(template =>
      !existingTitles.has(template.title)
    );

    if (newTemplates.length === 0) {
      console.log('✅ 모든 시드 템플릿이 이미 존재합니다.');
      return;
    }

    console.log(`📦 새로운 템플릿 ${newTemplates.length}개 삽입 중...`);

    // Supabase Admin API로 직접 삽입
    let successCount = 0;
    let failureCount = 0;

    for (const [index, template] of newTemplates.entries()) {
      try {
        console.log(`[${index + 1}/${newTemplates.length}] ${template.title} 삽입 중...`);

        // Supabase REST API 직접 호출
        const insertResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/templates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            ...template,
            is_public: true,
            user_id: 'system-planning'
          })
        });

        if (insertResponse.ok) {
          const insertedData = await insertResponse.json();
          console.log(`  ✅ ${template.title} 삽입 성공`);
          successCount++;
        } else {
          const errorText = await insertResponse.text();
          console.log(`  ❌ ${template.title} 삽입 실패: ${insertResponse.status} ${errorText}`);
          failureCount++;
        }

      } catch (error) {
        console.log(`  ❌ ${template.title} 삽입 오류:`, error.message);
        failureCount++;
      }
    }

    console.log('\n📈 삽입 결과:');
    console.log(`  성공: ${successCount}개`);
    console.log(`  실패: ${failureCount}개`);

    if (successCount > 0) {
      console.log('\n🎯 최종 확인 중...');
      const finalResponse = await fetch(`${BASE_URL}/api/templates`);
      if (finalResponse.ok) {
        const finalData = await finalResponse.json();
        console.log(`📊 총 템플릿: ${finalData.templates?.length || 0}개`);
      }
    }

    console.log('\n🎉 Templates 시드 데이터 삽입 완료!');

  } catch (error) {
    console.error('❌ 시드 데이터 삽입 중 오류:', error);
    process.exit(1);
  }
}

// 환경변수 로드
require('dotenv').config({ path: '.env.local' });

// 스크립트 실행
if (require.main === module) {
  seedTemplatesViaAPI();
}

module.exports = { seedTemplatesViaAPI };
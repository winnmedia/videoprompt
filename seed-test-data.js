#!/usr/bin/env node

/**
 * 테스트 데이터 시딩 스크립트
 * 데이터베이스에 샘플 스토리와 프롬프트를 추가합니다.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedTestData() {
  try {
    console.log('🌱 Seeding test data...');

    // 1. 테스트 스토리 추가
    const stories = [
      {
        title: '햇살이 비치는 카페',
        oneLineStory: '아침 햇살이 스며드는 따뜻한 카페에서 커피를 마시며 책을 읽는 여성',
        genre: 'Drama',
        tone: 'Peaceful',
        target: 'Young Adults',
        structure: JSON.stringify({
          act1: {
            title: '평온한 아침',
            description: '햇살이 창문을 통해 들어오는 카페 내부',
            key_elements: ['자연광', '따뜻한 분위기', '평화로운 공간'],
            emotional_arc: '평온 → 만족'
          },
          act2: {
            title: '독서 시간',
            description: '커피를 마시며 책에 집중하는 여성',
            key_elements: ['집중', '독서', '여유로운 시간'],
            emotional_arc: '만족 → 몰입'
          },
          act3: {
            title: '사색의 순간',
            description: '책에서 눈을 떼고 창밖을 바라보는 모습',
            key_elements: ['사색', '창밖 풍경', '내적 평화'],
            emotional_arc: '몰입 → 성찰'
          },
          act4: {
            title: '완벽한 마무리',
            description: '미소를 지으며 책을 덮고 마지막 커피를 마시는 모습',
            key_elements: ['만족감', '완성', '행복'],
            emotional_arc: '성찰 → 행복'
          }
        })
      },
      {
        title: '도시의 밤',
        oneLineStory: '네온사인이 반짝이는 도시의 밤거리를 걷는 사람들',
        genre: 'Urban',
        tone: 'Dynamic',
        target: 'Adults',
        structure: JSON.stringify({
          act1: {
            title: '도시의 불빛',
            description: '해가 지고 도시에 불빛이 켜지는 순간',
            key_elements: ['네온사인', '도시 경관', '황혼'],
            emotional_arc: '평온 → 활기'
          },
          act2: {
            title: '사람들의 발걸음',
            description: '바쁘게 오가는 사람들과 차량들',
            key_elements: ['움직임', '에너지', '도시 리듬'],
            emotional_arc: '활기 → 역동성'
          },
          act3: {
            title: '도시의 맥박',
            description: '카페, 상점, 지하철 등 도시 생활의 다양한 모습',
            key_elements: ['다양성', '생활', '연결성'],
            emotional_arc: '역동성 → 소속감'
          },
          act4: {
            title: '밤이 주는 위로',
            description: '밤늦게도 따뜻한 빛을 발하는 도시의 모습',
            key_elements: ['따뜻함', '안정감', '소속감'],
            emotional_arc: '소속감 → 안정'
          }
        })
      },
      {
        title: '자연 속 여행',
        oneLineStory: '산과 호수가 있는 자연 속에서 하이킹을 즐기는 모험',
        genre: 'Adventure',
        tone: 'Inspiring',
        target: 'Adventure Seekers',
        structure: JSON.stringify({
          act1: {
            title: '여행의 시작',
            description: '배낭을 메고 트레일 입구에 선 등산객',
            key_elements: ['시작점', '준비', '기대감'],
            emotional_arc: '기대 → 설렘'
          },
          act2: {
            title: '자연과의 만남',
            description: '숲길을 걸으며 만나는 다양한 자연의 모습',
            key_elements: ['나무', '새소리', '신선한 공기'],
            emotional_arc: '설렘 → 경이로움'
          },
          act3: {
            title: '정상의 경치',
            description: '힘든 등반 끝에 만난 아름다운 호수 전망',
            key_elements: ['성취감', '아름다운 경치', '휴식'],
            emotional_arc: '경이로움 → 성취감'
          },
          act4: {
            title: '새로운 다짐',
            description: '하산하며 자연에서 얻은 에너지와 다짐',
            key_elements: ['변화', '에너지', '새로운 시작'],
            emotional_arc: '성취감 → 영감'
          }
        })
      }
    ];

    console.log('📚 Adding test stories...');
    for (const story of stories) {
      await prisma.story.create({ data: story });
      console.log(`   ✅ Added story: "${story.title}"`);
    }

    // 2. 테스트 시나리오 추가 (기존 호환성)
    const scenarios = [
      {
        title: '테스트 시나리오 1',
        logline: '기본적인 영상 시나리오 테스트입니다.',
        structure4: JSON.stringify({
          scene1: '시작',
          scene2: '전개',
          scene3: '절정',
          scene4: '마무리'
        }),
        version: 1,
        createdBy: 'system'
      }
    ];

    console.log('🎬 Adding test scenarios...');
    for (const scenario of scenarios) {
      await prisma.scenario.create({ data: scenario });
      console.log(`   ✅ Added scenario: "${scenario.title}"`);
    }

    // 3. 데이터베이스 통계 출력
    const counts = await Promise.all([
      prisma.story.count(),
      prisma.scenario.count(),
      prisma.user.count(),
      prisma.prompt.count(),
    ]);

    console.log('\n📊 Database Summary:');
    console.log(`   📚 Stories: ${counts[0]}`);
    console.log(`   🎬 Scenarios: ${counts[1]}`);
    console.log(`   👥 Users: ${counts[2]}`);
    console.log(`   📝 Prompts: ${counts[3]}`);

    console.log('\n🎉 Test data seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
seedTestData();
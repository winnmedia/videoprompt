#!/usr/bin/env node

/**
 * GitHub 브랜치 보호 규칙 설정 스크립트
 * MCP 테스트를 필수로 하는 브랜치 보호 규칙을 자동으로 설정합니다.
 */

const { Octokit } = require('@octokit/rest');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function setupBranchProtection() {
  console.log('🔒 GitHub 브랜치 보호 규칙 설정');
  console.log('================================\n');

  try {
    // GitHub 토큰 입력
    const token = await question('GitHub Personal Access Token을 입력하세요: ');
    if (!token) {
      console.error('❌ GitHub 토큰이 필요합니다.');
      process.exit(1);
    }

    // 저장소 정보 입력
    const owner = await question('GitHub 사용자명/조직명을 입력하세요: ');
    const repo = await question('저장소 이름을 입력하세요: ');

    const octokit = new Octokit({ auth: token });

    console.log('\n🔧 브랜치 보호 규칙 설정 중...\n');

    // main 브랜치 보호 규칙
    await setupMainBranchProtection(octokit, owner, repo);

    // develop 브랜치 보호 규칙
    await setupDevelopBranchProtection(octokit, owner, repo);

    console.log('\n✅ 브랜치 보호 규칙 설정 완료!');
    console.log('\n📋 설정된 규칙:');
    console.log('   • main: 모든 MCP 테스트 + 2명 리뷰 필수');
    console.log('   • develop: 기본 MCP 테스트 + 1명 리뷰 필수');
  } catch (error) {
    console.error('❌ 설정 중 오류 발생:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function setupMainBranchProtection(octokit, owner, repo) {
  try {
    await octokit.repos.updateBranchProtection({
      owner,
      repo,
      branch: 'main',
      required_status_checks: {
        strict: true,
        contexts: [
          'MCP Unit Tests (18.x)',
          'MCP Unit Tests (20.x)',
          'MCP Integration Tests',
          'MCP Real Website Tests',
          'MCP Performance Tests',
        ],
      },
      enforce_admins: true,
      required_pull_request_reviews: {
        required_approving_review_count: 2,
        dismiss_stale_reviews: true,
        require_code_owner_reviews: true,
        require_last_push_approval: true,
      },
      restrictions: null,
      allow_force_pushes: false,
      allow_deletions: false,
      block_creations: false,
      required_conversation_resolution: true,
    });

    console.log('✅ main 브랜치 보호 규칙 설정 완료');
  } catch (error) {
    console.error('❌ main 브랜치 설정 실패:', error.message);
  }
}

async function setupDevelopBranchProtection(octokit, owner, repo) {
  try {
    await octokit.repos.updateBranchProtection({
      owner,
      repo,
      branch: 'develop',
      required_status_checks: {
        strict: true,
        contexts: ['MCP Unit Tests (18.x)', 'MCP Unit Tests (20.x)', 'MCP Integration Tests'],
      },
      enforce_admins: false,
      required_pull_request_reviews: {
        required_approving_review_count: 1,
        dismiss_stale_reviews: true,
        require_code_owner_reviews: false,
        require_last_push_approval: false,
      },
      restrictions: null,
      allow_force_pushes: false,
      allow_deletions: false,
      block_creations: false,
      required_conversation_resolution: true,
    });

    console.log('✅ develop 브랜치 보호 규칙 설정 완료');
  } catch (error) {
    console.error('❌ develop 브랜치 설정 실패:', error.message);
  }
}

// 스크립트 실행
if (require.main === module) {
  setupBranchProtection().catch(console.error);
}

module.exports = { setupBranchProtection };

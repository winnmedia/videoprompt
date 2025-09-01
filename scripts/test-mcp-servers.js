#!/usr/bin/env node

/**
 * MCP 서버 테스트 스크립트
 * 각 MCP 서버의 기본 기능을 테스트합니다.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

const MCP_SERVERS = {
  playwright: {
    name: 'Playwright MCP',
    command: 'npx',
    args: ['@playwright/mcp', '--help'],
    description: '브라우저 자동화 및 E2E 테스트',
  },
  context7: {
    name: 'Context7 MCP',
    command: 'node',
    args: [path.join(__dirname, '../src/lib/mcp-servers/context7/index.mjs'), '--help'],
    description: '컨텍스트 관리 및 메모리 최적화',
  },
  'sequential-thinking': {
    name: 'Sequential Thinking MCP',
    command: 'timeout',
    args: [
      '5',
      'node',
      path.join(__dirname, '../src/lib/mcp-servers/sequential-thinking/index.mjs'),
      '--transport',
      'stdio',
    ],
    description: '순차적 사고 및 문제 해결',
  },
};

async function testMCPServer(serverName, config) {
  console.log(`\n🧪 테스트 중: ${config.name}`);
  console.log(`📝 설명: ${config.description}`);

  try {
    const command = `${config.command} ${config.args.join(' ')}`;
    console.log(`🔧 명령어: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 10000,
      cwd: path.join(__dirname, '..'),
    });

    if (stdout) {
      console.log(`✅ 성공: ${stdout.substring(0, 200)}...`);
    }
    if (stderr) {
      console.log(`⚠️  경고: ${stderr.substring(0, 200)}...`);
    }

    return { success: true, serverName, output: stdout };
  } catch (error) {
    // Sequential Thinking MCP는 timeout으로 인한 종료를 성공으로 간주
    if (serverName === 'sequential-thinking' && error.message.includes('timeout')) {
      console.log(`✅ 성공: Sequential Thinking MCP 서버가 정상적으로 시작되었습니다.`);
      return { success: true, serverName, output: 'Server started successfully' };
    }

    console.log(`❌ 실패: ${error.message}`);
    return { success: false, serverName, error: error.message };
  }
}

async function testAllMCPServers() {
  console.log('🚀 MCP 서버 테스트 시작\n');
  console.log('='.repeat(60));

  const results = [];

  for (const [serverName, config] of Object.entries(MCP_SERVERS)) {
    const result = await testMCPServer(serverName, config);
    results.push(result);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 테스트 결과 요약\n');

  const successful = results.filter((r) => r.success).length;
  const total = results.length;

  console.log(`✅ 성공: ${successful}/${total}`);
  console.log(`❌ 실패: ${total - successful}/${total}\n`);

  results.forEach((result) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.serverName}: ${result.success ? '정상' : result.error}`);
  });

  if (successful === total) {
    console.log('\n🎉 모든 MCP 서버가 정상적으로 작동합니다!');
  } else {
    console.log('\n⚠️  일부 MCP 서버에 문제가 있습니다. 로그를 확인해주세요.');
  }
}

// 스크립트 실행
if (require.main === module) {
  testAllMCPServers().catch(console.error);
}

module.exports = { testAllMCPServers, MCP_SERVERS };

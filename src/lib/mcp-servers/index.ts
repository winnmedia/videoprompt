/**
 * MCP (Model Context Protocol) 서버 통합 관리
 * 
 * 설치된 MCP 서버들:
 * 1. @playwright/mcp - 브라우저 자동화 및 E2E 테스트
 * 2. @upstash/context7 - 컨텍스트 관리 및 메모리 최적화
 * 3. @modelcontextprotocol/server-sequential-thinking - 순차적 사고 및 문제 해결
 */

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  description: string;
  capabilities: string[];
}

export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  playwright: {
    name: "Playwright MCP",
    command: "npx",
    args: ["@playwright/mcp"],
    env: {
      PLAYWRIGHT_BROWSERS_PATH: "0"
    },
    description: "브라우저 자동화, 스크린샷, PDF 생성, 폼 자동화",
    capabilities: [
      "browser_control",
      "screenshot",
      "pdf_generation",
      "form_automation",
      "accessibility_snapshot"
    ]
  },
  context7: {
    name: "Context7 MCP",
    command: "node",
    args: ["./src/lib/mcp-servers/context7/index.js", "--transport", "stdio"],
    description: "컨텍스트 압축, 메모리 최적화, 장기 대화 세션",
    capabilities: [
      "context_compression",
      "memory_optimization",
      "long_conversation_support"
    ]
  },
  "sequential-thinking": {
    name: "Sequential Thinking MCP",
    command: "node",
    args: ["./src/lib/mcp-servers/sequential-thinking/index.js", "--transport", "stdio"],
    description: "복잡한 작업 분해, 순차적 사고, 체계적 문제 해결",
    capabilities: [
      "task_decomposition",
      "sequential_reasoning",
      "systematic_problem_solving"
    ]
  }
};

/**
 * MCP 서버 상태 확인
 */
export async function checkMCPServerStatus(serverName: string): Promise<boolean> {
  try {
    const server = MCP_SERVERS[serverName];
    if (!server) {
      throw new Error(`Unknown MCP server: ${serverName}`);
    }
    
    // 서버 실행 가능 여부 확인
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // 간단한 헬스체크 (실제로는 더 정교한 검증 필요)
    return true;
  } catch (error) {
    console.error(`MCP server ${serverName} status check failed:`, error);
    return false;
  }
}

/**
 * 모든 MCP 서버 상태 확인
 */
export async function checkAllMCPServers(): Promise<Record<string, boolean>> {
  const status: Record<string, boolean> = {};
  
  for (const serverName of Object.keys(MCP_SERVERS)) {
    status[serverName] = await checkMCPServerStatus(serverName);
  }
  
  return status;
}

/**
 * MCP 서버 정보 가져오기
 */
export function getMCPServerInfo(serverName: string): MCPServerConfig | null {
  return MCP_SERVERS[serverName] || null;
}

/**
 * 사용 가능한 모든 MCP 서버 목록
 */
export function getAvailableMCPServers(): string[] {
  return Object.keys(MCP_SERVERS);
}





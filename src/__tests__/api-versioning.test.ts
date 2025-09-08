/**
 * API Versioning Tests
 * 
 * CineGenius v3.1 API 엔드포인트의 버전별 라우팅과
 * 호환성을 테스트합니다.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../app/api/planning/prompt/route';
import { createV3Example } from '../lib/schemas';

// Mock dependencies
vi.mock('../lib/db', () => ({
  prisma: {
    prompt: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../shared/lib/auth', () => ({
  getUserIdFromRequest: vi.fn(() => 'test-user-id'),
}));

vi.mock('../shared/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../config/features', () => ({
  features: {
    CINEGENIUS_V3: true,
    EXPERT_MODE: true,
    STYLE_FUSION: true,
  },
}));

describe('API Versioning', () => {
  // Mock data for tests
  const mockPrompts = [
    {
      id: 'v3-prompt-1',
      version: 3,
      scenarioId: 'scenario-1',
      metadata: {
        prompt_name: 'Test V3.1 Prompt',
        v3_metadata: {
          promptName: 'Test V3.1 Prompt',
          baseStyle: { visualStyle: 'Cinematic' },
        },
      },
      timeline: [
        {
          sequence: 0,
          timestamp: '00:00:00.000',
          visualDirecting: 'Test action',
        },
      ],
      negative: [],
      createdAt: '2025-09-08T00:00:00.000Z',
      updatedAt: '2025-09-08T00:00:00.000Z',
      project_id: 'project-1',
      cinegenius_version: '3.1',
      user_input: { oneLineScenario: 'Test scenario' },
      project_config: { creationMode: 'VISUAL_FIRST' },
      generation_control: { directorEmphasis: [] },
      aiAnalysis: {},
    },
    {
      id: 'v2-prompt-1',
      version: 1,
      scenarioId: 'scenario-2',
      metadata: {
        prompt_name: 'Test Legacy Prompt',
        base_style: 'Cinematic',
      },
      timeline: [],
      negative: [],
      createdAt: '2025-09-08T00:00:00.000Z',
      updatedAt: '2025-09-08T00:00:00.000Z',
      project_id: null,
      cinegenius_version: '2.0',
      user_input: null,
      project_config: null,
      generation_control: null,
      aiAnalysis: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================================================
  // 🚀 POST Endpoint Tests
  // =============================================================================

  describe('POST /api/planning/prompt', () => {
    test('creates v3.1 prompt successfully', async () => {
      const { prisma } = await import('../lib/db');
      const mockCreatedPrompt = {
        id: 'test-prompt-id',
        version: 3,
        project_id: 'test-project-id',
        cinegenius_version: '3.1',
      };
      (prisma.prompt.create as any).mockResolvedValue(mockCreatedPrompt);

      const v3Data = createV3Example();
      const request = new NextRequest('http://localhost/api/planning/prompt', {
        method: 'POST',
        body: JSON.stringify(v3Data),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData.ok).toBe(true);
      expect(responseData.data.cinegenius_version).toBe('3.1');
      expect(responseData.data.projectId).toBe(v3Data.projectId);
      expect(prisma.prompt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project_id: v3Data.projectId,
          cinegenius_version: '3.1',
          user_input: v3Data.userInput,
          project_config: v3Data.projectConfig,
          version: 3,
        }),
      });
    });

    test('creates legacy prompt successfully', async () => {
      const { prisma } = await import('../lib/db');
      const mockCreatedPrompt = {
        id: 'test-legacy-id',
        version: 1,
        cinegenius_version: '2.0',
      };
      (prisma.prompt.create as any).mockResolvedValue(mockCreatedPrompt);

      const legacyData = {
        scenarioId: '123e4567-e89b-12d3-a456-426614174000',
        metadata: {
          prompt_name: 'Legacy Test',
          base_style: 'Cinematic',
          aspect_ratio: '16:9',
          room_description: 'Test room',
          camera_setup: '35mm',
        },
        timeline: [
          {
            sequence: 0,
            timestamp: '00:00-00:02',
            action: 'Test action',
            audio: 'Test audio',
          },
        ],
        text: 'Test prompt',
        keywords: ['test'],
      };

      const request = new NextRequest('http://localhost/api/planning/prompt', {
        method: 'POST',
        body: JSON.stringify(legacyData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData.ok).toBe(true);
      expect(responseData.data.cinegenius_version).toBe('2.0');
      expect(prisma.prompt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scenarioId: legacyData.scenarioId,
          cinegenius_version: '2.0',
          version: expect.any(Number),
        }),
      });
    });

    test('rejects v3.1 prompt when feature flag is disabled', async () => {
      // Temporarily disable feature flag
      vi.doMock('../config/features', () => ({
        features: {
          CINEGENIUS_V3: false,
        },
      }));

      const v3Data = createV3Example();
      const request = new NextRequest('http://localhost/api/planning/prompt', {
        method: 'POST',
        body: JSON.stringify(v3Data),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.ok).toBe(false);
      expect(responseData.code).toBe('FEATURE_DISABLED');
    });

    test('validates v3.1 prompt schema strictly', async () => {
      const invalidV3Data = {
        version: '3.1',
        projectId: 'invalid-uuid', // Invalid UUID format
        createdAt: 'invalid-date', // Invalid date format
        userInput: {
          oneLineScenario: '', // Empty required field
        },
        // Missing required fields...
      };

      const request = new NextRequest('http://localhost/api/planning/prompt', {
        method: 'POST',
        body: JSON.stringify(invalidV3Data),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.ok).toBe(false);
      expect(responseData.code).toBe('VALIDATION_ERROR');
    });

    test('handles database errors gracefully', async () => {
      const { prisma } = await import('../lib/db');
      (prisma.prompt.create as any).mockRejectedValue(new Error('Database error'));

      const v3Data = createV3Example();
      const request = new NextRequest('http://localhost/api/planning/prompt', {
        method: 'POST',
        body: JSON.stringify(v3Data),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.ok).toBe(false);
      expect(responseData.code).toBe('VALIDATION_ERROR');
    });
  });

  // =============================================================================
  // 📋 GET Endpoint Tests
  // =============================================================================

  describe('GET /api/planning/prompt', () => {

    test('returns all prompts without version filter', async () => {
      const { prisma } = await import('../lib/db');
      (prisma.prompt.findMany as any).mockResolvedValue(mockPrompts);

      const request = new NextRequest('http://localhost/api/planning/prompt');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.ok).toBe(true);
      expect(responseData.data.data).toHaveLength(2);
      expect(responseData.data.stats.total).toBe(2);
      expect(responseData.data.stats.v3_count).toBe(1);
      expect(responseData.data.stats.v2_count).toBe(1);
    });

    test('filters by version=3.1', async () => {
      const { prisma } = await import('../lib/db');
      (prisma.prompt.findMany as any).mockResolvedValue([mockPrompts[0]]);

      const request = new NextRequest('http://localhost/api/planning/prompt?version=3.1');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.data).toHaveLength(1);
      expect(responseData.data.stats.v3_count).toBe(1);
      expect(responseData.data.stats.v2_count).toBe(0);
      expect(prisma.prompt.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          cinegenius_version: '3.1',
        }),
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
    });

    test('filters by version=2.x', async () => {
      const { prisma } = await import('../lib/db');
      (prisma.prompt.findMany as any).mockResolvedValue([mockPrompts[1]]);

      const request = new NextRequest('http://localhost/api/planning/prompt?version=2.x');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.data).toHaveLength(1);
      expect(prisma.prompt.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { cinegenius_version: '2.0' },
            { cinegenius_version: null },
          ],
        }),
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
    });

    test('returns v3.1 full structure when includeV3=true', async () => {
      const { prisma } = await import('../lib/db');
      (prisma.prompt.findMany as any).mockResolvedValue([mockPrompts[0]]);

      const request = new NextRequest(
        'http://localhost/api/planning/prompt?version=3.1&includeV3=true'
      );
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      const prompt = responseData.data.data[0];
      expect(prompt.version).toBe('3.1');
      expect(prompt.projectId).toBe('project-1');
      expect(prompt.userInput).toBeDefined();
      expect(prompt.projectConfig).toBeDefined();
      expect(prompt.promptBlueprint).toBeDefined();
      expect(prompt.generationControl).toBeDefined();
    });

    test('returns legacy format for v2.x prompts', async () => {
      const { prisma } = await import('../lib/db');
      (prisma.prompt.findMany as any).mockResolvedValue([mockPrompts[1]]);

      const request = new NextRequest('http://localhost/api/planning/prompt?version=2.x');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      const prompt = responseData.data.data[0];
      expect(prompt.id).toBe('v2-prompt-1');
      expect(prompt.version).toBe(1);
      expect(prompt.scenarioId).toBe('scenario-2');
      expect(prompt.metadata).toBeDefined();
      expect(prompt.timeline).toBeDefined();
      expect(prompt.cinegenius_version).toBe('2.0');
    });

    test('handles empty results gracefully', async () => {
      const { prisma } = await import('../lib/db');
      (prisma.prompt.findMany as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/planning/prompt');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.ok).toBe(true);
      expect(responseData.data.data).toHaveLength(0);
      expect(responseData.data.stats.total).toBe(0);
    });

    test('filters by scenarioId parameter', async () => {
      const { prisma } = await import('../lib/db');
      (prisma.prompt.findMany as any).mockResolvedValue([mockPrompts[0]]);

      const scenarioId = '123e4567-e89b-12d3-a456-426614174000';
      const request = new NextRequest(
        `http://localhost/api/planning/prompt?scenarioId=${scenarioId}`
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.prompt.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          scenarioId: scenarioId,
        }),
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
    });

    test('handles database errors in GET', async () => {
      const { prisma } = await import('../lib/db');
      (prisma.prompt.findMany as any).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/planning/prompt');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.ok).toBe(false);
      expect(responseData.code).toBe('QUERY_ERROR');
    });
  });

  // =============================================================================
  // 🔄 Integration Tests
  // =============================================================================

  describe('Integration Scenarios', () => {
    test('round-trip: create v3.1 prompt and retrieve it', async () => {
      const { prisma } = await import('../lib/db');
      
      // Mock creation
      const v3Data = createV3Example();
      const mockCreatedPrompt = {
        id: 'integration-test-id',
        version: 3,
        project_id: v3Data.projectId,
        cinegenius_version: '3.1',
      };
      (prisma.prompt.create as any).mockResolvedValue(mockCreatedPrompt);

      // Create prompt
      const createRequest = new NextRequest('http://localhost/api/planning/prompt', {
        method: 'POST',
        body: JSON.stringify(v3Data),
        headers: { 'Content-Type': 'application/json' },
      });

      const createResponse = await POST(createRequest);
      const createData = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(createData.ok).toBe(true);

      // Mock retrieval
      const mockRetrievedPrompt = {
        id: 'integration-test-id',
        version: 3,
        scenarioId: 'temp-scenario-id',
        metadata: { v3_metadata: v3Data.promptBlueprint.metadata },
        timeline: v3Data.promptBlueprint.timeline,
        negative: v3Data.finalOutput.negativePrompts,
        createdAt: new Date(),
        updatedAt: new Date(),
        project_id: v3Data.projectId,
        cinegenius_version: '3.1',
        user_input: v3Data.userInput,
        project_config: v3Data.projectConfig,
        generation_control: v3Data.generationControl,
        aiAnalysis: v3Data.aiAnalysis || {},
      };
      (prisma.prompt.findMany as any).mockResolvedValue([mockRetrievedPrompt]);

      // Retrieve prompt
      const getRequest = new NextRequest(
        'http://localhost/api/planning/prompt?version=3.1&includeV3=true'
      );

      const getResponse = await GET(getRequest);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData.ok).toBe(true);
      expect(getData.data.data).toHaveLength(1);
      
      const retrieved = getData.data.data[0];
      expect(retrieved.version).toBe('3.1');
      expect(retrieved.projectId).toBe(v3Data.projectId);
      expect(retrieved.userInput.oneLineScenario).toBe(v3Data.userInput.oneLineScenario);
    });

    test('mixed version environment: both v2.x and v3.1 prompts', async () => {
      const { prisma } = await import('../lib/db');
      (prisma.prompt.findMany as any).mockResolvedValue(mockPrompts);

      const request = new NextRequest('http://localhost/api/planning/prompt');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data.stats.total).toBe(2);
      expect(responseData.data.stats.v3_count).toBe(1);
      expect(responseData.data.stats.v2_count).toBe(1);
      
      // Check that both versions are properly formatted
      const prompts = responseData.data.data;
      const v3Prompt = prompts.find((p: any) => p.cinegenius_version === '3.1');
      const v2Prompt = prompts.find((p: any) => p.cinegenius_version === '2.0');
      
      expect(v3Prompt).toBeDefined();
      expect(v2Prompt).toBeDefined();
      expect(v3Prompt.projectId).toBeDefined(); // v3.1 should have projectId
      expect(v2Prompt.scenarioId).toBeDefined(); // v2.x should have scenarioId
    });
  });
});
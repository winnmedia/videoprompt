/**
 * Unified API Routes - 통합 버전
 * 모든 API 엔드포인트를 단일 파일로 관리
 */

import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface AuthData {
  email?: string;
  password?: string;
  name?: string;
  isGuest?: boolean;
}

interface StoryData {
  title: string;
  content: string;
  genre: string;
  tone?: string;
  targetDuration?: number;
}

interface ContentData {
  type: 'story' | 'scenario' | 'storyboard' | 'prompt';
  title: string;
  data: any;
}

// Utility functions
function createResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function createErrorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

// Rate limiting check
function checkRateLimit(request: NextRequest) {
  const ip = request.ip || 'unknown';
  // Simple rate limiting logic here
  return true; // Allow for now
}

// Cost safety check
function checkCostSafety(operation: string) {
  // Simple cost safety check
  return true; // Allow for now
}

// Main API handler
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  if (!checkRateLimit(request)) {
    return createErrorResponse('Rate limit exceeded', 429);
  }

  try {
    switch (endpoint) {
      case 'health':
        return createResponse({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });

      case 'auth/me':
        return createResponse({
          user: {
            id: 'guest-user',
            name: 'Guest User',
            isGuest: true,
            email: null
          }
        });

      case 'contents':
        return createResponse({
          contents: [
            {
              id: '1',
              type: 'story',
              title: 'Sample Story',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          total: 1
        });

      default:
        return createErrorResponse('Endpoint not found', 404);
    }
  } catch (error) {
    console.error('API Error:', error);
    return createErrorResponse('Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  if (!checkRateLimit(request)) {
    return createErrorResponse('Rate limit exceeded', 429);
  }

  try {
    const body = await request.json();

    switch (endpoint) {
      case 'auth/login': {
        const { email, password } = body as AuthData;

        if (!email || !password) {
          return createErrorResponse('Email and password required', 400);
        }

        return createResponse({
          user: {
            id: 'user-123',
            email,
            name: 'Test User',
            isGuest: false
          },
          token: 'mock-jwt-token'
        });
      }

      case 'auth/register': {
        const { email, password, name } = body as AuthData;

        if (!email || !password || !name) {
          return createErrorResponse('Email, password, and name required', 400);
        }

        return createResponse({
          user: {
            id: 'user-new',
            email,
            name,
            isGuest: false
          },
          message: 'User registered successfully'
        });
      }

      case 'auth/guest': {
        return createResponse({
          user: {
            id: 'guest-' + Date.now(),
            name: 'Guest User',
            isGuest: true,
            email: null
          },
          token: 'guest-token'
        });
      }

      case 'story/generate': {
        if (!checkCostSafety('story-generation')) {
          return createErrorResponse('Cost safety limit reached', 429);
        }

        const { title, content, genre } = body as StoryData;

        if (!title || !content) {
          return createErrorResponse('Title and content required', 400);
        }

        // Mock story generation
        return createResponse({
          story: {
            id: 'story-' + Date.now(),
            title,
            summary: `Generated ${genre} story`,
            genre,
            status: 'draft',
            totalDuration: 120,
            chapters: {
              setup: {
                title: '설정',
                content: '스토리 시작 부분',
                duration: 30,
                thumbnailUrl: null
              },
              confrontation: {
                title: '갈등',
                content: '문제 발생',
                duration: 60,
                thumbnailUrl: null
              },
              resolution: {
                title: '해결',
                content: '문제 해결',
                duration: 30,
                thumbnailUrl: null
              }
            },
            metadata: {
              generatedAt: new Date().toISOString(),
              tone: 'neutral',
              keywords: ['AI', 'generated', genre]
            }
          }
        });
      }

      case 'contents/create': {
        const { type, title, data } = body as ContentData;

        if (!type || !title) {
          return createErrorResponse('Type and title required', 400);
        }

        return createResponse({
          content: {
            id: `${type}-${Date.now()}`,
            type,
            title,
            data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        });
      }

      default:
        return createErrorResponse('Endpoint not found', 404);
    }
  } catch (error) {
    console.error('API Error:', error);
    return createErrorResponse('Invalid request body', 400);
  }
}

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  const id = searchParams.get('id');

  try {
    const body = await request.json();

    switch (endpoint) {
      case 'contents/update': {
        if (!id) {
          return createErrorResponse('ID required', 400);
        }

        return createResponse({
          content: {
            id,
            ...body,
            updatedAt: new Date().toISOString()
          }
        });
      }

      default:
        return createErrorResponse('Endpoint not found', 404);
    }
  } catch (error) {
    console.error('API Error:', error);
    return createErrorResponse('Invalid request body', 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  const id = searchParams.get('id');

  try {
    switch (endpoint) {
      case 'contents/delete': {
        if (!id) {
          return createErrorResponse('ID required', 400);
        }

        return createResponse({
          message: 'Content deleted successfully',
          id
        });
      }

      default:
        return createErrorResponse('Endpoint not found', 404);
    }
  } catch (error) {
    console.error('API Error:', error);
    return createErrorResponse('Internal server error');
  }
}
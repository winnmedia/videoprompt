import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'VideoPlanet API v1.0',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      auth: '/api/auth/*',
      ai: '/api/ai/*',
      planning: '/api/planning/*',
      video: '/api/video/*',
      upload: '/api/upload/*',
      health: '/api/health'
    },
    documentation: 'https://www.vridge.kr/docs',
    timestamp: new Date().toISOString()
  });
}
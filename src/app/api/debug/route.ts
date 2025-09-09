import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasSendgridKey: !!process.env.SENDGRID_API_KEY,
      hasDefaultEmail: !!process.env.DEFAULT_FROM_EMAIL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      timestamp: new Date().toISOString(),
    },
    message: 'Environment diagnostic'
  });
}
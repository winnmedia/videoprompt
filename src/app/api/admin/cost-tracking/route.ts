/**
 * Cost Tracking API
 * $300 사건 방지를 위한 비용 추적 시스템
 */

import { NextRequest, NextResponse } from 'next/server';

// 임시 메모리 저장소 (실제 환경에서는 데이터베이스 사용)
let costTracking = {
  dailyLimit: 50.0, // $50 일일 한도
  currentUsage: 0.0,
  lastReset: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  requestCount: 0
};

// 일일 리셋 체크
function checkDailyReset() {
  const today = new Date().toISOString().split('T')[0];
  if (costTracking.lastReset !== today) {
    costTracking.currentUsage = 0.0;
    costTracking.requestCount = 0;
    costTracking.lastReset = today;
  }
}

export async function GET() {
  try {
    checkDailyReset();

    return NextResponse.json({
      success: true,
      data: {
        dailyLimit: costTracking.dailyLimit,
        currentUsage: costTracking.currentUsage,
        remaining: (costTracking.dailyLimit - costTracking.currentUsage).toFixed(2),
        requestCount: costTracking.requestCount,
        lastReset: costTracking.lastReset
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to get cost tracking data' }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    checkDailyReset();

    const { cost } = await request.json();

    // 비용 한도 체크
    if (costTracking.currentUsage + cost > costTracking.dailyLimit) {
      return NextResponse.json({
        success: false,
        error: { message: 'Daily cost limit exceeded' }
      }, { status: 429 });
    }

    // 비용 추가
    costTracking.currentUsage += cost;
    costTracking.requestCount += 1;

    return NextResponse.json({
      success: true,
      data: {
        addedCost: cost,
        totalUsage: costTracking.currentUsage,
        remaining: (costTracking.dailyLimit - costTracking.currentUsage).toFixed(2)
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to add cost' }
    }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // 비용 추적 초기화
    costTracking = {
      dailyLimit: 50.0,
      currentUsage: 0.0,
      lastReset: new Date().toISOString().split('T')[0],
      requestCount: 0
    };

    return NextResponse.json({
      success: true,
      data: { message: 'Cost tracking reset successfully' }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to reset cost tracking' }
    }, { status: 500 });
  }
}
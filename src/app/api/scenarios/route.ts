import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// 환경변수 검증
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Scenario 생성/업데이트용 스키마
const ScenarioSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10).max(5000),
  genre: z.string(),
  style: z.string(),
  target: z.string(),
  structure: z.string(),
  intensity: z.string(),
  quality_score: z.number().optional(),
  estimated_duration: z.number().optional(),
  cost: z.number().optional(),
  tokens: z.number().optional(),
  feedback: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
});

// GET: 사용자의 시나리오 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { data: scenarios, error } = await supabase
      .from('scenarios')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scenarios' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      scenarios: scenarios || [],
      count: scenarios?.length || 0,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 새 시나리오 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, ...scenarioData } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 데이터 검증
    const validatedData = ScenarioSchema.parse(scenarioData);

    const { data: scenario, error } = await supabase
      .from('scenarios')
      .insert({
        user_id,
        ...validatedData,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create scenario' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      scenario,
      message: 'Scenario created successfully',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: 시나리오 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...scenarioData } = body;

    if (!id || !user_id) {
      return NextResponse.json(
        { error: 'Scenario ID and User ID are required' },
        { status: 400 }
      );
    }

    // 데이터 검증
    const validatedData = ScenarioSchema.partial().parse(scenarioData);

    const { data: scenario, error } = await supabase
      .from('scenarios')
      .update(validatedData)
      .eq('id', id)
      .eq('user_id', user_id) // 보안: 자신의 시나리오만 수정 가능
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to update scenario' },
        { status: 500 }
      );
    }

    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      scenario,
      message: 'Scenario updated successfully',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: 시나리오 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('user_id');

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Scenario ID and User ID are required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('scenarios')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // 보안: 자신의 시나리오만 삭제 가능

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to delete scenario' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Scenario deleted successfully',
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
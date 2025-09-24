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

// Act 스키마
const ActSchema = z.object({
  title: z.string(),
  content: z.string(),
  duration: z.number(),
  keyEvents: z.array(z.string()).optional(),
});

// Story 생성/업데이트용 스키마
const StorySchema = z.object({
  scenario_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  synopsis: z.string().min(10).max(2000),
  genre: z.string(),
  target_audience: z.string(),
  tone: z.string(),
  total_duration: z.number(),
  acts: z.object({
    setup: ActSchema,
    development: ActSchema,
    climax: ActSchema,
    resolution: ActSchema,
  }),
  generation_params: z.object({
    creativity: z.number().optional(),
    intensity: z.number().optional(),
    pacing: z.string().optional(),
  }).optional(),
  progress: z.number().optional(),
  cost: z.number().optional(),
});

// GET: 사용자의 스토리 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const scenarioId = searchParams.get('scenario_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('stories')
      .select(`
        *,
        scenarios (
          id,
          title,
          genre
        )
      `)
      .eq('user_id', userId);

    if (scenarioId) {
      query = query.eq('scenario_id', scenarioId);
    }

    const { data: stories, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stories' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      stories: stories || [],
      count: stories?.length || 0,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 새 스토리 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, ...storyData } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 데이터 검증
    const validatedData = StorySchema.parse(storyData);

    const { data: story, error } = await supabase
      .from('stories')
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
        { error: 'Failed to create story' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      story,
      message: 'Story created successfully',
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

// PUT: 스토리 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...storyData } = body;

    if (!id || !user_id) {
      return NextResponse.json(
        { error: 'Story ID and User ID are required' },
        { status: 400 }
      );
    }

    // 데이터 검증
    const validatedData = StorySchema.partial().parse(storyData);

    const { data: story, error } = await supabase
      .from('stories')
      .update(validatedData)
      .eq('id', id)
      .eq('user_id', user_id) // 보안: 자신의 스토리만 수정 가능
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to update story' },
        { status: 500 }
      );
    }

    if (!story) {
      return NextResponse.json(
        { error: 'Story not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      story,
      message: 'Story updated successfully',
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

// DELETE: 스토리 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('user_id');

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Story ID and User ID are required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // 보안: 자신의 스토리만 삭제 가능

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to delete story' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Story deleted successfully',
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
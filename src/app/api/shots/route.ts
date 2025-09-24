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

// Storyboard 스키마
const StoryboardSchema = z.object({
  status: z.enum(['pending', 'generating', 'completed', 'failed']),
  imageUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  prompt: z.string().optional(),
  generatedAt: z.string().optional(),
});

// Shot 생성/업데이트용 스키마
const ShotSchema = z.object({
  story_id: z.string().uuid().optional(),
  shot_number: z.number().min(1).max(12),
  global_order: z.number().min(1).max(12),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  act_type: z.enum(['setup', 'development', 'climax', 'resolution']),
  shot_type: z.string(),
  camera_angle: z.string(),
  lighting: z.string(),
  duration: z.number().min(1).max(60),
  storyboard: StoryboardSchema.optional(),
});

// GET: 스토리의 숏트 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const storyId = searchParams.get('story_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('shots')
      .select(`
        *,
        stories (
          id,
          title,
          genre
        )
      `)
      .eq('user_id', userId);

    if (storyId) {
      query = query.eq('story_id', storyId);
    }

    const { data: shots, error } = await query
      .order('global_order', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch shots' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      shots: shots || [],
      count: shots?.length || 0,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 새 숏트 생성 (또는 여러 숏트 일괄 생성)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, shots: shotsData } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 단일 숏트인지 여러 숏트인지 확인
    const isMultiple = Array.isArray(shotsData);
    const shots = isMultiple ? shotsData : [shotsData];

    // 각 숏트 데이터 검증
    const validatedShots = shots.map(shot => ({
      user_id,
      ...ShotSchema.parse(shot),
    }));

    const { data: createdShots, error } = await supabase
      .from('shots')
      .insert(validatedShots)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create shots' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      shots: createdShots,
      count: createdShots?.length || 0,
      message: `${createdShots?.length || 0} shot(s) created successfully`,
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

// PUT: 숏트 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...shotData } = body;

    if (!id || !user_id) {
      return NextResponse.json(
        { error: 'Shot ID and User ID are required' },
        { status: 400 }
      );
    }

    // 데이터 검증
    const validatedData = ShotSchema.partial().parse(shotData);

    const { data: shot, error } = await supabase
      .from('shots')
      .update(validatedData)
      .eq('id', id)
      .eq('user_id', user_id) // 보안: 자신의 숏트만 수정 가능
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to update shot' },
        { status: 500 }
      );
    }

    if (!shot) {
      return NextResponse.json(
        { error: 'Shot not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      shot,
      message: 'Shot updated successfully',
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

// PATCH: 숏트 스토리보드 업데이트 (이미지 생성 결과 등)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, storyboard } = body;

    if (!id || !user_id || !storyboard) {
      return NextResponse.json(
        { error: 'Shot ID, User ID, and storyboard data are required' },
        { status: 400 }
      );
    }

    // 스토리보드 데이터 검증
    const validatedStoryboard = StoryboardSchema.parse(storyboard);

    const { data: shot, error } = await supabase
      .from('shots')
      .update({ storyboard: validatedStoryboard })
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to update shot storyboard' },
        { status: 500 }
      );
    }

    if (!shot) {
      return NextResponse.json(
        { error: 'Shot not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      shot,
      message: 'Shot storyboard updated successfully',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid storyboard data', details: error.errors },
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

// DELETE: 숏트 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('user_id');

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Shot ID and User ID are required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('shots')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // 보안: 자신의 숏트만 삭제 가능

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to delete shot' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Shot deleted successfully',
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
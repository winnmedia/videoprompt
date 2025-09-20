/**
 * Supabase Storage 버킷 생성 및 테스트 스크립트
 */

const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { config } = require('dotenv');

// 환경변수 로드
config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function setupVideoUploadsBucket() {
  try {
    console.log('🔧 video-uploads 버킷 설정 시작...');

    // 1. 기존 버킷 확인
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ 버킷 목록 조회 실패:', listError);
      return;
    }

    console.log('📁 기존 버킷 목록:', buckets?.map(b => b.name));

    // 2. video-uploads 버킷이 있는지 확인
    const existingBucket = buckets?.find(bucket => bucket.name === 'video-uploads');

    if (existingBucket) {
      console.log('✅ video-uploads 버킷이 이미 존재합니다.');
    } else {
      // 3. 버킷 생성
      console.log('🆕 video-uploads 버킷 생성 중...');
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('video-uploads', {
        public: true,
      });

      if (createError) {
        console.error('❌ 버킷 생성 실패:', createError);
        return;
      }

      console.log('✅ video-uploads 버킷 생성 완료:', newBucket);
    }

    // 4. 테스트 파일 업로드
    console.log('🧪 테스트 파일 업로드 중...');
    const testContent = Buffer.from('test video content', 'utf-8');
    const testPath = `test/test-${Date.now()}.mp4`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('video-uploads')
      .upload(testPath, testContent, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ 테스트 파일 업로드 실패:', uploadError);
      return;
    }

    console.log('✅ 테스트 파일 업로드 성공:', uploadData.path);

    // 5. 공개 URL 생성 테스트
    const { data: urlData } = supabase.storage
      .from('video-uploads')
      .getPublicUrl(testPath);

    console.log('🔗 공개 URL:', urlData.publicUrl);

    // 6. 테스트 파일 삭제
    const { error: deleteError } = await supabase.storage
      .from('video-uploads')
      .remove([testPath]);

    if (deleteError) {
      console.error('⚠️ 테스트 파일 삭제 실패:', deleteError);
    } else {
      console.log('🗑️ 테스트 파일 삭제 완료');
    }

    console.log('🎉 Supabase Storage 설정 완료!');

  } catch (error) {
    console.error('❌ 설정 중 오류 발생:', error);
  }
}

setupVideoUploadsBucket();
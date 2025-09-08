'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

interface SharedContent {
  id: string;
  type: 'scenario' | 'prompt' | 'video' | 'project';
  title: string;
  description: string;
  data: any;
  createdAt: string;
  owner: {
    username: string;
    avatarUrl?: string;
  };
  shareRole: 'viewer' | 'commenter';
  expiresAt: string;
}

interface SharePageProps {
  params: {
    token: string;
  };
}

export default function SharePage({ params }: SharePageProps) {
  const { token } = params;
  const [content, setContent] = useState<SharedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nickname, setNickname] = useState('');
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);

  // 공유 콘텐츠 로드
  useEffect(() => {
    loadSharedContent();
  }, [token]);

  const loadSharedContent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/share/${token}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setContent(data.data.content);
          setComments(data.data.comments || []);
        } else {
          setError(data.message || '공유 링크가 유효하지 않습니다.');
        }
      } else {
        setError('공유 콘텐츠를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !nickname.trim()) {
      alert('닉네임과 댓글을 모두 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`/api/share/${token}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname,
          comment,
        }),
      });

      if (response.ok) {
        setComment('');
        loadSharedContent(); // 댓글 새로고침
      } else {
        alert('댓글 작성에 실패했습니다.');
      }
    } catch (error) {
      alert('네트워크 오류가 발생했습니다.');
    }
  };

  const isExpired = content && new Date(content.expiresAt) < new Date();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="spinner" size="xl" className="mx-auto mb-4" />
          <p className="text-gray-600">공유 콘텐츠를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="error" size="xl" className="mx-auto mb-4 text-red-400" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">접근할 수 없습니다</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.href = '/'}>홈으로 돌아가기</Button>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="clock" size="xl" className="mx-auto mb-4 text-yellow-400" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">만료된 링크</h1>
          <p className="text-gray-600 mb-4">이 공유 링크는 만료되었습니다.</p>
          <Button onClick={() => window.location.href = '/'}>홈으로 돌아가기</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Icon 
                  name={content.type === 'video' ? 'video' : 'projects'} 
                  className="h-8 w-8 text-primary-600" 
                />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">{content.title}</h1>
                <div className="flex items-center mt-1 text-sm text-gray-500">
                  <span>공유자: {content.owner.username}</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(content.createdAt).toLocaleDateString('ko-KR')}</span>
                  <span className="mx-2">•</span>
                  <span className={content.shareRole === 'viewer' ? 'text-blue-600' : 'text-green-600'}>
                    {content.shareRole === 'viewer' ? '읽기 전용' : '댓글 가능'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              만료일: {new Date(content.expiresAt).toLocaleDateString('ko-KR')}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 콘텐츠 표시 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">콘텐츠</h2>
          
          {content.description && (
            <div className="mb-6">
              <p className="text-gray-600">{content.description}</p>
            </div>
          )}

          {/* 콘텐츠 타입별 렌더링 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            {content.type === 'scenario' && (
              <div>
                <h3 className="font-medium mb-2">시나리오 구조</h3>
                {content.data.structure4 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">4단계 구조:</h4>
                    <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                      {content.data.structure4.map((step: string, index: number) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {content.data.shots12 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">12숏 구성:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {content.data.shots12.map((shot: string, index: number) => (
                        <div key={index} className="bg-white p-2 rounded text-xs">
                          {index + 1}. {shot}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {content.type === 'prompt' && (
              <div>
                <h3 className="font-medium mb-2">프롬프트 설정</h3>
                <div className="space-y-3 text-sm">
                  {content.data.baseStyle && (
                    <div>
                      <span className="font-medium text-gray-700">기본 스타일:</span>
                      <span className="ml-2 text-gray-600">{content.data.baseStyle.join(', ')}</span>
                    </div>
                  )}
                  {content.data.keywords && (
                    <div>
                      <span className="font-medium text-gray-700">키워드:</span>
                      <span className="ml-2 text-gray-600">{content.data.keywords.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {content.type === 'video' && (
              <div>
                <h3 className="font-medium mb-2">영상 정보</h3>
                <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center mb-4">
                  {content.data.videoUrl ? (
                    <video controls className="w-full h-full rounded-lg">
                      <source src={content.data.videoUrl} type="video/mp4" />
                    </video>
                  ) : (
                    <div className="text-center text-gray-500">
                      <Icon name="video" size="xl" className="mx-auto mb-2" />
                      <p>영상을 불러올 수 없습니다</p>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  <p>제공자: {content.data.provider}</p>
                  <p>길이: {content.data.duration}초</p>
                </div>
              </div>
            )}

            {content.type === 'project' && (
              <div>
                <h3 className="font-medium mb-2">프로젝트 정보</h3>
                <p className="text-sm text-gray-600">프로젝트 세부 내용이 여기에 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* 댓글 섹션 (commenter 권한이 있을 때만) */}
        {content.shareRole === 'commenter' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">댓글</h2>

            {/* 댓글 작성 */}
            <div className="mb-6">
              <div className="flex space-x-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="닉네임"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <Button onClick={handleAddComment} size="sm">
                  댓글 작성
                </Button>
              </div>
              <textarea
                placeholder="댓글을 입력하세요..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* 댓글 목록 */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-center text-gray-500 text-sm">첫 번째 댓글을 작성해보세요!</p>
              ) : (
                comments.map((comment, index) => (
                  <div key={index} className="border-b border-gray-200 pb-4">
                    <div className="flex items-center mb-2">
                      <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {comment.author?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="ml-2 text-sm font-medium text-gray-900">
                        {comment.author}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 ml-8">{comment.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
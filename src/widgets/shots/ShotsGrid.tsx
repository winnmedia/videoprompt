/**
 * 12단계 숏트 그리드
 * 드래그앤드롭 지원 및 접근성 완전 준수
 * @dnd-kit 활용한 키보드 네비게이션 지원
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragMoveEvent,
  UniqueIdentifier
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
  restrictToWindowEdges
} from '@dnd-kit/modifiers';

import type { TwelveShotCollection, TwelveShot } from '../../entities/Shot';
import { ShotCard } from './ShotCard';

interface ShotsGridProps {
  collection: TwelveShotCollection;
  selectedShotId?: string | null;
  isDragEnabled?: boolean;
  onShotOrderChange?: (newCollection: TwelveShotCollection) => void;
  onShotSelect?: (shotId: string) => void;
  onShotEdit?: (shotId: string, field: string, value: string) => void;
  onGenerateStoryboard?: (shotId: string) => void;
  onRegenerateStoryboard?: (shotId: string) => void;
  onDownloadStoryboard?: (shotId: string) => void;
  className?: string;
}

export function ShotsGrid({
  collection,
  selectedShotId,
  isDragEnabled = true,
  onShotOrderChange,
  onShotSelect,
  onShotEdit,
  onGenerateStoryboard,
  onRegenerateStoryboard,
  onDownloadStoryboard,
  className = ''
}: ShotsGridProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [draggedShot, setDraggedShot] = useState<TwelveShot | null>(null);
  const [announcements, setAnnouncements] = useState<string>('');

  const announcementRef = useRef<HTMLDivElement>(null);

  // dnd-kit 센서 설정 (접근성 최적화)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이동해야 드래그 시작 (우발적 드래그 방지)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 접근성 안내 메시지 업데이트
  const announce = useCallback((message: string) => {
    setAnnouncements(message);
  }, []);

  // 드래그 시작
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const shot = collection.shots.find(s => s.id === active.id);

    if (shot) {
      setActiveId(active.id);
      setDraggedShot(shot);
      announce(`${shot.globalOrder}번 숏트 "${shot.title}" 드래그 시작. 화살표 키로 이동 가능합니다.`);
    }
  }, [collection.shots, announce]);

  // 드래그 이동 중
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    // 드래그 중 실시간 피드백은 성능상 최소화
  }, []);

  // 드래그 완료
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setDraggedShot(null);

    if (!over || active.id === over.id) {
      announce('숏트 순서가 변경되지 않았습니다.');
      return;
    }

    const activeShot = collection.shots.find(s => s.id === active.id);
    const overShot = collection.shots.find(s => s.id === over.id);

    if (!activeShot || !overShot) {
      announce('숏트 순서 변경에 실패했습니다.');
      return;
    }

    const oldIndex = collection.shots.findIndex(s => s.id === active.id);
    const newIndex = collection.shots.findIndex(s => s.id === over.id);

    if (oldIndex !== newIndex) {
      const newShots = arrayMove(collection.shots, oldIndex, newIndex);

      // globalOrder 재정렬
      const updatedShots = newShots.map((shot, index) => ({
        ...shot,
        globalOrder: index + 1,
        updatedAt: new Date().toISOString()
      }));

      const updatedCollection = {
        ...collection,
        shots: updatedShots,
        updatedAt: new Date().toISOString()
      };

      onShotOrderChange?.(updatedCollection);

      announce(
        `${activeShot.globalOrder}번 숏트 "${activeShot.title}"를 ` +
        `${overShot.globalOrder}번 위치로 이동했습니다. ` +
        `새로운 순서는 ${newIndex + 1}번입니다.`
      );
    }
  }, [collection, onShotOrderChange, announce]);

  // Act별 그룹핑
  const groupedShots = {
    setup: collection.shots.filter(shot => shot.actType === 'setup'),
    development: collection.shots.filter(shot => shot.actType === 'development'),
    climax: collection.shots.filter(shot => shot.actType === 'climax'),
    resolution: collection.shots.filter(shot => shot.actType === 'resolution')
  };

  const actTitles = {
    setup: '1막: 도입',
    development: '2막: 전개',
    climax: '3막: 절정',
    resolution: '4막: 결말'
  };

  // 키보드 안내 메시지
  const keyboardInstructions = isDragEnabled ?
    '스페이스바를 눌러 드래그를 시작하고, 화살표 키로 이동한 후 스페이스바로 놓으세요.' :
    '드래그 기능이 비활성화되어 있습니다.';

  return (
    <div className={`w-full ${className}`}>
      {/* 접근성 안내 */}
      <div
        ref={announcementRef}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcements}
      </div>

      {/* 키보드 안내 */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-900 mb-2">
          키보드 사용법
        </h3>
        <p className="text-sm text-blue-700">
          {keyboardInstructions}
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
        accessibility={{
          announcements: {
            onDragStart({ active }) {
              const shot = collection.shots.find(s => s.id === active.id);
              return shot ? `${shot.globalOrder}번 숏트 드래그 시작` : '드래그 시작';
            },
            onDragOver({ active, over }) {
              if (!over) return '드래그 가능한 영역을 벗어났습니다';

              const activeShot = collection.shots.find(s => s.id === active.id);
              const overShot = collection.shots.find(s => s.id === over.id);

              if (activeShot && overShot) {
                return `${activeShot.globalOrder}번을 ${overShot.globalOrder}번 위치로 이동 중`;
              }
              return '이동 중';
            },
            onDragEnd({ active, over }) {
              if (!over) return '드래그가 취소되었습니다';

              const activeShot = collection.shots.find(s => s.id === active.id);
              const overShot = collection.shots.find(s => s.id === over.id);

              if (activeShot && overShot && active.id !== over.id) {
                return `${activeShot.globalOrder}번 숏트를 ${overShot.globalOrder}번 위치로 이동했습니다`;
              }
              return '숏트 순서가 변경되지 않았습니다';
            },
            onDragCancel({ active }) {
              const shot = collection.shots.find(s => s.id === active.id);
              return shot ? `${shot.globalOrder}번 숏트 드래그가 취소되었습니다` : '드래그가 취소되었습니다';
            }
          }
        }}
      >
        <SortableContext
          items={collection.shots.map(shot => shot.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* Act별 그룹 렌더링 */}
          {Object.entries(groupedShots).map(([actType, shots]) => (
            shots.length > 0 && (
              <div key={actType} className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  {actTitles[actType as keyof typeof actTitles]}
                  <span className="text-sm font-normal text-slate-500">
                    ({shots.length}개 숏트)
                  </span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {shots
                    .sort((a, b) => a.globalOrder - b.globalOrder)
                    .map((shot) => (
                      <ShotCard
                        key={shot.id}
                        shot={shot}
                        isSelected={selectedShotId === shot.id}
                        isDragDisabled={!isDragEnabled}
                        onSelect={onShotSelect}
                        onEdit={onShotEdit}
                        onGenerateStoryboard={onGenerateStoryboard}
                        onRegenerateStoryboard={onRegenerateStoryboard}
                        onDownloadStoryboard={onDownloadStoryboard}
                      />
                    ))}
                </div>
              </div>
            )
          ))}
        </SortableContext>

        {/* 드래그 오버레이 */}
        <DragOverlay>
          {activeId && draggedShot ? (
            <div className="rotate-3 opacity-90">
              <ShotCard
                shot={draggedShot}
                isDragDisabled={true}
                className="shadow-2xl border-blue-300"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 빈 상태 */}
      {collection.shots.length === 0 && (
        <div className="text-center py-12">
          <div className="text-slate-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            숏트가 없습니다
          </h3>
          <p className="text-slate-500">
            4단계 스토리를 먼저 완성한 후 12단계 숏트를 생성해보세요.
          </p>
        </div>
      )}
    </div>
  );
}
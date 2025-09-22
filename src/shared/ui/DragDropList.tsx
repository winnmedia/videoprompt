/**
 * DragDropList Component
 * CLAUDE.md 준수: 접근성 WCAG 2.1 AA, 타입 안전성
 */

'use client';

import React, { useState, useCallback, ReactNode } from 'react';

export interface DragDropItem {
  id: string;
  content: ReactNode;
  data?: any;
}

export interface DragDropListProps {
  items: DragDropItem[];
  onReorder: (items: DragDropItem[]) => void;
  className?: string;
  itemClassName?: string;
  dragHandleClassName?: string;
  placeholder?: ReactNode;
  'data-testid'?: string;
}

export function DragDropList({
  items,
  onReorder,
  className = '',
  itemClassName = '',
  dragHandleClassName = '',
  placeholder,
  'data-testid': testId,
}: DragDropListProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (!draggedItem) return;

    const draggedIndex = items.findIndex(item => item.id === draggedItem);
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDraggedItem(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...items];
    const [draggedItemData] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItemData);

    onReorder(newItems);
    setDraggedItem(null);
    setDragOverIndex(null);
  }, [items, draggedItem, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverIndex(null);
  }, []);

  if (items.length === 0 && placeholder) {
    return (
      <div
        className={`p-8 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-lg ${className}`}
        data-testid={testId}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`} data-testid={testId}>
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, item.id)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={`
            relative p-3 bg-white border border-gray-200 rounded-lg cursor-move transition-all duration-200
            hover:border-gray-300 hover:shadow-sm
            ${draggedItem === item.id ? 'opacity-50 scale-95' : ''}
            ${dragOverIndex === index ? 'border-blue-500 shadow-md' : ''}
            ${itemClassName}
          `}
          data-testid={`${testId}-item-${item.id}`}
        >
          {/* Drag Handle */}
          <div
            className={`absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 ${dragHandleClassName}`}
            aria-label="Drag handle"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path d="M10 4a2 2 0 100-4 2 2 0 000 4z" />
              <path d="M10 20a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </div>

          {/* Content */}
          <div className="ml-8">
            {item.content}
          </div>
        </div>
      ))}
    </div>
  );
}

export default DragDropList;
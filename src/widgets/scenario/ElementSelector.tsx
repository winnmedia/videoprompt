'use client';

/**
 * 시나리오 요소 선택기 위젯
 * 장르, 스타일, 타겟을 위한 향상된 드롭다운 컴포넌트
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface ElementSelectorProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  'aria-describedby'?: string;
}

export function ElementSelector({
  label,
  value,
  options,
  onChange,
  placeholder = '선택해주세요',
  disabled = false,
  required = false,
  className = '',
  id,
  'aria-describedby': ariaDescribedBy,
}: ElementSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 선택된 옵션 찾기
  const selectedOption = options.find(option => option.value === value);

  // 필터된 옵션
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 키보드 네비게이션
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          const selectedOption = filteredOptions[highlightedIndex];
          if (selectedOption) {
            onChange(selectedOption.value);
            setIsOpen(false);
            setSearchTerm('');
            setHighlightedIndex(-1);
          }
        } else {
          setIsOpen(!isOpen);
        }
        break;

      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        }
        break;

      case 'Tab':
        if (isOpen) {
          setIsOpen(false);
          setSearchTerm('');
          setHighlightedIndex(-1);
        }
        break;
    }
  };

  // 옵션 선택
  const handleOptionSelect = (option: Option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  // 드롭다운 토글
  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
      setHighlightedIndex(-1);
      // 다음 틱에서 포커스 (DOM 업데이트 후)
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const dropdownId = id || `element-selector-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 라벨 */}
      <label
        htmlFor={dropdownId}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-label="필수">*</span>}
      </label>

      {/* 선택 버튼 */}
      <button
        type="button"
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-left border rounded-md
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900 cursor-pointer hover:border-gray-400'}
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${dropdownId}-label`}
        aria-describedby={ariaDescribedBy}
        id={dropdownId}
      >
        <div className="flex items-center justify-between">
          <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDownIcon
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {/* 검색 입력 */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="검색..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label={`${label} 검색`}
            />
          </div>

          {/* 옵션 리스트 */}
          <ul
            role="listbox"
            aria-labelledby={`${dropdownId}-label`}
            className="max-h-60 overflow-auto py-1"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">
                검색 결과가 없습니다.
              </li>
            ) : (
              filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  className={`
                    px-3 py-2 cursor-pointer select-none
                    ${option.value === value ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}
                    ${index === highlightedIndex ? 'bg-blue-50' : ''}
                    hover:bg-blue-50
                  `}
                  onClick={() => handleOptionSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-sm text-gray-500 mt-1">
                      {option.description}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Plus, X, Upload, User, Box } from 'lucide-react';
import { type Character, type CoreObject, type Elements } from '@/types/video-prompt';
import { generateId } from '@/shared/lib/utils';
import { cn } from '@/shared/lib/utils';

interface ElementBuilderProps {
  elements: Elements;
  onElementsChange: (elements: Elements) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export const ElementBuilder: React.FC<ElementBuilderProps> = ({
  elements,
  onElementsChange,
  onNext,
  onPrevious,
}) => {
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const addCharacter = () => {
    const newCharacter: Character = {
      id: generateId(),
      description: '',
      reference_image_url: undefined,
    };

    onElementsChange({
      ...elements,
      characters: [...elements.characters, newCharacter],
    });
  };

  const updateCharacter = (id: string, field: keyof Character, value: string) => {
    const updatedCharacters = elements.characters.map((char) =>
      char.id === id ? { ...char, [field]: value } : char,
    );

    onElementsChange({
      ...elements,
      characters: updatedCharacters,
    });
  };

  const removeCharacter = (id: string) => {
    const updatedCharacters = elements.characters.filter((char) => char.id !== id);
    onElementsChange({
      ...elements,
      characters: updatedCharacters,
    });
  };

  const addCoreObject = () => {
    const newObject: CoreObject = {
      id: generateId(),
      description: '',
      reference_image_url: undefined,
    };

    onElementsChange({
      ...elements,
      core_objects: [...elements.core_objects, newObject],
    });
  };

  const updateCoreObject = (id: string, field: keyof CoreObject, value: string) => {
    const updatedObjects = elements.core_objects.map((obj) =>
      obj.id === id ? { ...obj, [field]: value } : obj,
    );

    onElementsChange({
      ...elements,
      core_objects: updatedObjects,
    });
  };

  const removeCoreObject = (id: string) => {
    const updatedObjects = elements.core_objects.filter((obj) => obj.id !== id);
    onElementsChange({
      ...elements,
      core_objects: updatedObjects,
    });
  };

  const handleImageUpload = async (file: File, elementId: string, type: 'character' | 'object') => {
    // 실제 구현에서는 API 호출을 통해 이미지 업로드
    const fakeUrl = URL.createObjectURL(file);

    if (type === 'character') {
      updateCharacter(elementId, 'reference_image_url', fakeUrl);
    } else {
      updateCoreObject(elementId, 'reference_image_url', fakeUrl);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string[]> = {};

    // 캐릭터 검증
    elements.characters.forEach((char, index) => {
      if (!char.description.trim()) {
        if (!newErrors.characters) newErrors.characters = [];
        newErrors.characters.push(`캐릭터 ${index + 1}의 설명을 입력해주세요`);
      }
    });

    // 핵심 사물 검증
    elements.core_objects.forEach((obj, index) => {
      if (!obj.description.trim()) {
        if (!newErrors.core_objects) newErrors.core_objects = [];
        newErrors.core_objects.push(`핵심 사물 ${index + 1}의 설명을 입력해주세요`);
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onNext();
    }
  };

  const isFormValid =
    elements.characters.length > 0 &&
    elements.core_objects.length > 0 &&
    elements.characters.every((char) => char.description.trim()) &&
    elements.core_objects.every((obj) => obj.description.trim());

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold text-gray-900">장면 요소 정의</h1>
        <p className="text-lg text-gray-600">
          등장인물과 핵심 사물을 정의하여 AI가 더 정확한 영상을 생성할 수 있도록 도와주세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 등장인물 관리 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
              <User className="h-5 w-5 text-primary-600" />
              등장인물
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCharacter}
              leftIcon={<Plus className="h-4 w-4" />}
              data-testid="btn-add-character"
            >
              캐릭터 추가
            </Button>
          </div>

          {elements.characters.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
              <User className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <p className="text-gray-500">아직 등장인물이 없습니다</p>
              <p className="text-sm text-gray-400">+ 버튼을 클릭하여 첫 번째 캐릭터를 추가하세요</p>
            </div>
          ) : (
            <div className="space-y-4">
              {elements.characters.map((character, index) => {
                const descId = `character-desc-${character.id}`;
                return (
                  <div
                    key={character.id}
                    className="space-y-4 rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">캐릭터 {index + 1}</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCharacter(character.id)}
                        leftIcon={<X className="h-4 w-4" />}
                      >
                        제거
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor={descId} className="block text-sm font-medium text-gray-700">
                          캐릭터 설명 *
                        </label>
                        <textarea
                          id={descId}
                          data-testid="textarea-character-desc"
                          aria-label="캐릭터 설명 *"
                          value={character.description}
                          onChange={(e) =>
                            updateCharacter(character.id, 'description', e.target.value)
                          }
                          placeholder="예: 전술복을 입은 남성, 검은색 마스크, 권총을 소지"
                          rows={3}
                          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          레퍼런스 이미지
                        </label>
                        <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center">
                          {character.reference_image_url ? (
                            <div className="space-y-2">
                              <img
                                src={character.reference_image_url}
                                alt="캐릭터 레퍼런스"
                                className="mx-auto h-32 w-full rounded-md object-cover"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateCharacter(character.id, 'reference_image_url', '')
                                }
                              >
                                이미지 제거
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                              <input
                                type="file"
                                data-testid="input-character-image"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleImageUpload(file, character.id, 'character');
                                  }
                                }}
                                className="block"
                                id={`character-image-${character.id}`}
                              />
                              <label
                                htmlFor={`character-image-${character.id}`}
                                className="cursor-pointer text-sm text-primary-600 hover:text-primary-700"
                              >
                                이미지 업로드
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {errors.characters && (
            <div className="space-y-1 text-sm text-danger-600">
              {errors.characters.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          )}
        </div>

        {/* 핵심 사물 관리 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
              <Box className="h-5 w-5 text-primary-600" />
              핵심 사물
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCoreObject}
              leftIcon={<Plus className="h-4 w-4" />}
              data-testid="btn-add-object"
            >
              사물 추가
            </Button>
          </div>

          {elements.core_objects.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
              <Box className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <p className="text-gray-500">아직 핵심 사물이 없습니다</p>
              <p className="text-sm text-gray-400">+ 버튼을 클릭하여 첫 번째 사물을 추가하세요</p>
            </div>
          ) : (
            <div className="space-y-4">
              {elements.core_objects.map((object, index) => {
                const descId = `object-desc-${object.id}`;
                return (
                  <div key={object.id} className="space-y-4 rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">핵심 사물 {index + 1}</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCoreObject(object.id)}
                        leftIcon={<X className="h-4 w-4" />}
                      >
                        제거
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor={descId} className="block text-sm font-medium text-gray-700">
                          사물 설명 *
                        </label>
                        <textarea
                          id={descId}
                          data-testid="textarea-object-desc"
                          aria-label="사물 설명 *"
                          value={object.description}
                          onChange={(e) =>
                            updateCoreObject(object.id, 'description', e.target.value)
                          }
                          placeholder="예: 금속 가방, 빛나는 잠금 패널, 반사되는 표면"
                          rows={3}
                          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="textsm block font-medium text-gray-700">
                          레퍼런스 이미지
                        </label>
                        <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center">
                          {object.reference_image_url ? (
                            <div className="space-y-2">
                              <img
                                src={object.reference_image_url}
                                alt="사물 레퍼런스"
                                className="mx-auto h-32 w-full rounded-md object-cover"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateCoreObject(object.id, 'reference_image_url', '')
                                }
                              >
                                이미지 제거
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                              <input
                                type="file"
                                data-testid="input-object-image"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleImageUpload(file, object.id, 'object');
                                  }
                                }}
                                className="block"
                                id={`object-image-${object.id}`}
                              />
                              <label
                                htmlFor={`object-image-${object.id}`}
                                className="cursor-pointer text-sm text-primary-600 hover:text-primary-700"
                              >
                                이미지 업로드
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {errors.core_objects && (
            <div className="space-y-1 text-sm text-danger-600">
              {errors.core_objects.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          )}
        </div>

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onPrevious}
            className="px-8 py-3 text-lg"
            data-testid="btn-prev-step2"
          >
            ← 이전 단계
          </Button>

          <Button
            type="submit"
            disabled={!isFormValid}
            className="px-8 py-3 text-lg"
            data-testid="btn-next-step2"
          >
            다음 단계 →
          </Button>
        </div>
      </form>
    </div>
  );
};

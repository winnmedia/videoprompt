import { z } from 'zod';
import {
  StoryboardSchema,
  StoryboardLayoutSchema,
  StoryboardFrameSchema,
  ExportFormatSchema,
  TemplateTypeSchema,
  type Storyboard,
  type StoryboardLayout,
  type StoryboardFrame,
  type ExportFormat,
  type TemplateType,
  type CreateStoryboardRequest,
  type ExportStoryboardRequest,
} from '@/entities/storyboard';

describe('Storyboard Types and Schemas', () => {
  describe('StoryboardLayoutSchema', () => {
    it('should validate allowed layout types', () => {
      expect(() => StoryboardLayoutSchema.parse('grid-2x6')).not.toThrow();
      expect(() => StoryboardLayoutSchema.parse('grid-3x4')).not.toThrow();
      expect(() => StoryboardLayoutSchema.parse('grid-4x3')).not.toThrow();
      expect(() => StoryboardLayoutSchema.parse('timeline')).not.toThrow();
      expect(() => StoryboardLayoutSchema.parse('detailed')).not.toThrow();
    });

    it('should reject invalid layout types', () => {
      expect(() => StoryboardLayoutSchema.parse('invalid')).toThrow();
      expect(() => StoryboardLayoutSchema.parse('')).toThrow();
      expect(() => StoryboardLayoutSchema.parse(null)).toThrow();
    });
  });

  describe('ExportFormatSchema', () => {
    it('should validate allowed export formats', () => {
      expect(() => ExportFormatSchema.parse('pdf')).not.toThrow();
      expect(() => ExportFormatSchema.parse('png')).not.toThrow();
      expect(() => ExportFormatSchema.parse('jpg')).not.toThrow();
      expect(() => ExportFormatSchema.parse('svg')).not.toThrow();
    });

    it('should reject invalid export formats', () => {
      expect(() => ExportFormatSchema.parse('gif')).toThrow();
      expect(() => ExportFormatSchema.parse('bmp')).toThrow();
    });
  });

  describe('TemplateTypeSchema', () => {
    it('should validate industry standard template types', () => {
      expect(() => TemplateTypeSchema.parse('standard')).not.toThrow();
      expect(() => TemplateTypeSchema.parse('detailed')).not.toThrow();
      expect(() => TemplateTypeSchema.parse('commercial')).not.toThrow();
      expect(() => TemplateTypeSchema.parse('animation')).not.toThrow();
      expect(() => TemplateTypeSchema.parse('documentary')).not.toThrow();
    });

    it('should reject invalid template types', () => {
      expect(() => TemplateTypeSchema.parse('custom')).toThrow();
      expect(() => TemplateTypeSchema.parse('')).toThrow();
    });
  });

  describe('StoryboardFrameSchema', () => {
    const validFrame = {
      id: 'frame-1',
      order: 1,
      shotRef: 'shot-1',
      sketchUrl: 'https://example.com/sketch.jpg',
      description: 'Opening scene establishing shot',
      notes: 'Consider adding ambient sound',
      duration: 5.5,
      cameraAngle: 'wide',
      visualElements: ['building', 'sky', 'crowd'],
    };

    it('should validate valid storyboard frame', () => {
      expect(() => StoryboardFrameSchema.parse(validFrame)).not.toThrow();
    });

    it('should require mandatory fields', () => {
      expect(() => StoryboardFrameSchema.parse({
        ...validFrame,
        id: '',
      })).toThrow();

      expect(() => StoryboardFrameSchema.parse({
        ...validFrame,
        shotRef: '',
      })).toThrow();

      expect(() => StoryboardFrameSchema.parse({
        ...validFrame,
        description: '',
      })).toThrow();
    });

    it('should validate order as positive integer', () => {
      expect(() => StoryboardFrameSchema.parse({
        ...validFrame,
        order: 0,
      })).toThrow();

      expect(() => StoryboardFrameSchema.parse({
        ...validFrame,
        order: -1,
      })).toThrow();

      expect(() => StoryboardFrameSchema.parse({
        ...validFrame,
        order: 1.5,
      })).toThrow();
    });

    it('should validate duration as positive number', () => {
      expect(() => StoryboardFrameSchema.parse({
        ...validFrame,
        duration: 0,
      })).toThrow();

      expect(() => StoryboardFrameSchema.parse({
        ...validFrame,
        duration: -1,
      })).toThrow();
    });

    it('should make optional fields truly optional', () => {
      const minimalFrame = {
        id: 'frame-1',
        order: 1,
        shotRef: 'shot-1',
        description: 'Test frame',
        duration: 3.0,
        cameraAngle: 'medium',
        visualElements: ['test'],
      };

      expect(() => StoryboardFrameSchema.parse(minimalFrame)).not.toThrow();
    });
  });

  describe('StoryboardSchema', () => {
    const validStoryboard = {
      id: 'storyboard-1',
      title: 'My Movie Storyboard',
      shotRefs: ['shot-1', 'shot-2', 'shot-3'],
      frames: [
        {
          id: 'frame-1',
          order: 1,
          shotRef: 'shot-1',
          description: 'Opening scene',
          duration: 5.0,
          cameraAngle: 'wide',
          visualElements: ['building'],
        },
        {
          id: 'frame-2',
          order: 2,
          shotRef: 'shot-2',
          description: 'Character intro',
          duration: 3.0,
          cameraAngle: 'close-up',
          visualElements: ['face'],
        },
      ],
      layout: 'grid-3x4',
      templateType: 'standard',
      totalDuration: 8.0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should validate valid storyboard', () => {
      expect(() => StoryboardSchema.parse(validStoryboard)).not.toThrow();
    });

    it('should require mandatory fields', () => {
      expect(() => StoryboardSchema.parse({
        ...validStoryboard,
        id: '',
      })).toThrow();

      expect(() => StoryboardSchema.parse({
        ...validStoryboard,
        title: '',
      })).toThrow();
    });

    it('should limit shotRefs to maximum 12', () => {
      const tooManyShots = Array.from({ length: 13 }, (_, i) => `shot-${i + 1}`);

      expect(() => StoryboardSchema.parse({
        ...validStoryboard,
        shotRefs: tooManyShots,
      })).toThrow();
    });

    it('should require at least one shotRef', () => {
      expect(() => StoryboardSchema.parse({
        ...validStoryboard,
        shotRefs: [],
      })).toThrow();
    });

    it('should validate datetime strings', () => {
      expect(() => StoryboardSchema.parse({
        ...validStoryboard,
        createdAt: 'invalid-date',
      })).toThrow();

      expect(() => StoryboardSchema.parse({
        ...validStoryboard,
        updatedAt: '2024-01-01',
      })).toThrow();
    });

    it('should validate totalDuration as non-negative', () => {
      expect(() => StoryboardSchema.parse({
        ...validStoryboard,
        totalDuration: -1,
      })).toThrow();

      expect(() => StoryboardSchema.parse({
        ...validStoryboard,
        totalDuration: 0,
      })).not.toThrow();
    });
  });

  describe('Request Types', () => {
    describe('CreateStoryboardRequest', () => {
      it('should validate create request structure', () => {
        const createRequest: CreateStoryboardRequest = {
          title: 'Test Storyboard',
          shotRefs: ['shot-1', 'shot-2'],
          layout: 'grid-2x6',
          templateType: 'standard',
        };

        // This should not throw since we're just testing the type structure
        expect(createRequest.title).toBe('Test Storyboard');
        expect(createRequest.shotRefs).toHaveLength(2);
        expect(createRequest.layout).toBe('grid-2x6');
        expect(createRequest.templateType).toBe('standard');
      });
    });

    describe('ExportStoryboardRequest', () => {
      it('should validate export request structure', () => {
        const exportRequest: ExportStoryboardRequest = {
          storyboardId: 'storyboard-1',
          format: 'pdf',
          includeNotes: true,
          includeTimestamps: false,
        };

        expect(exportRequest.storyboardId).toBe('storyboard-1');
        expect(exportRequest.format).toBe('pdf');
        expect(exportRequest.includeNotes).toBe(true);
        expect(exportRequest.includeTimestamps).toBe(false);
      });
    });
  });

  describe('Type Inference', () => {
    it('should properly infer types from schemas', () => {
      // Test type inference works correctly
      const layout: StoryboardLayout = 'grid-3x4';
      const format: ExportFormat = 'png';
      const template: TemplateType = 'commercial';

      expect(layout).toBe('grid-3x4');
      expect(format).toBe('png');
      expect(template).toBe('commercial');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays appropriately', () => {
      const storyboardWithEmptyFrames = {
        id: 'storyboard-1',
        title: 'Empty Storyboard',
        shotRefs: ['shot-1'],
        frames: [],
        layout: 'grid-2x6',
        templateType: 'standard',
        totalDuration: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Empty frames array should be allowed
      expect(() => StoryboardSchema.parse(storyboardWithEmptyFrames)).not.toThrow();
    });

    it('should handle maximum values correctly', () => {
      const maxShots = Array.from({ length: 12 }, (_, i) => `shot-${i + 1}`);

      const storyboardWithMaxShots = {
        id: 'storyboard-1',
        title: 'Max Shots Storyboard',
        shotRefs: maxShots,
        frames: [],
        layout: 'timeline',
        templateType: 'animation',
        totalDuration: 120.5,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(() => StoryboardSchema.parse(storyboardWithMaxShots)).not.toThrow();
    });
  });
});
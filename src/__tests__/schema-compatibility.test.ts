/**
 * Schema Compatibility Tests
 * 
 * CineGenius v3.1과 Legacy 스키마 간의 호환성을 테스트합니다.
 */

import { describe, test, expect } from 'vitest';
import { 
  validateByVersion, 
  detectPromptVersion,
  CineGeniusV3PromptSchema,
  ScenePromptSchema,
  createV3Example,
  migrateV2ToV3 
} from '../lib/schemas';

describe('Schema Compatibility', () => {
  
  // =============================================================================
  // 🧪 Version Detection Tests
  // =============================================================================
  
  describe('Version Detection', () => {
    test('detects v3.1 by explicit version field', () => {
      const v3Data = { version: '3.1', projectId: 'test-id' };
      expect(detectPromptVersion(v3Data)).toBe('3.1');
    });
    
    test('detects v3.1 by structure (projectBlueprint)', () => {
      const v3Data = { projectId: 'test-id', promptBlueprint: {} };
      expect(detectPromptVersion(v3Data)).toBe('3.1');
    });
    
    test('detects v2.x by legacy structure', () => {
      const v2Data = { metadata: { prompt_name: 'test' }, timeline: [] };
      expect(detectPromptVersion(v2Data)).toBe('2.x');
    });
    
    test('returns unknown for invalid data', () => {
      expect(detectPromptVersion(null)).toBe('unknown');
      expect(detectPromptVersion({})).toBe('unknown');
      expect(detectPromptVersion('invalid')).toBe('unknown');
    });
  });
  
  // =============================================================================
  // 🔄 Schema Validation Tests
  // =============================================================================
  
  describe('Schema Validation', () => {
    test('validates v3.1 data successfully', () => {
      const v3Data = createV3Example();
      expect(() => validateByVersion(v3Data)).not.toThrow();
    });
    
    test('validates legacy data successfully', () => {
      const legacyData = {
        metadata: {
          prompt_name: 'Test Prompt',
          base_style: 'Cinematic',
          aspect_ratio: '16:9',
          room_description: 'A modern office',
          camera_setup: '35mm lens',
        },
        key_elements: ['person'],
        assembled_elements: ['desk', 'computer'],
        timeline: [
          {
            sequence: 0,
            timestamp: '00:00-00:02',
            action: 'Person sits down',
            audio: 'Ambient office sounds',
          },
        ],
        text: 'A cinematic scene in a modern office',
        keywords: ['office', 'modern', 'professional'],
      };
      
      expect(() => validateByVersion(legacyData)).not.toThrow();
    });
    
    test('throws error for invalid v3.1 data', () => {
      const invalidV3Data = {
        version: '3.1',
        // Missing required fields
      };
      
      expect(() => CineGeniusV3PromptSchema.parse(invalidV3Data)).toThrow();
    });
    
    test('throws error for invalid legacy data', () => {
      const invalidLegacyData = {
        metadata: {
          // Missing required fields
        },
      };
      
      expect(() => ScenePromptSchema.parse(invalidLegacyData)).toThrow();
    });
  });
  
  // =============================================================================
  // 🎯 Specific v3.1 Validation Tests
  // =============================================================================
  
  describe('CineGenius v3.1 Specific Validation', () => {
    test('validates style fusion ratios', () => {
      const v3Data = createV3Example();
      
      // Valid ratio
      v3Data.promptBlueprint.metadata.baseStyle.styleFusion.ratio = 0.7;
      expect(() => CineGeniusV3PromptSchema.parse(v3Data)).not.toThrow();
      
      // Invalid ratio (out of range)
      v3Data.promptBlueprint.metadata.baseStyle.styleFusion.ratio = 1.5;
      expect(() => CineGeniusV3PromptSchema.parse(v3Data)).toThrow();
    });
    
    test('validates aspect ratio patterns', () => {
      const v3Data = createV3Example();
      
      // Valid aspect ratios
      const validRatios = ['16:9', '9:16', '4:3', '21:9', '2.39:1', '1.85:1'];
      validRatios.forEach(ratio => {
        v3Data.promptBlueprint.metadata.deliverySpec.aspectRatio = ratio;
        expect(() => CineGeniusV3PromptSchema.parse(v3Data)).not.toThrow();
      });
      
      // Invalid aspect ratios
      const invalidRatios = ['16x9', '16/9', 'widescreen', '16:'];
      invalidRatios.forEach(ratio => {
        v3Data.promptBlueprint.metadata.deliverySpec.aspectRatio = ratio;
        expect(() => CineGeniusV3PromptSchema.parse(v3Data)).toThrow();
      });
    });
    
    test('validates camera physical parameters', () => {
      const v3Data = createV3Example();
      
      // Valid aperture values
      const validApertures = ['f/1.4', 'f/2.8', 'f/5.6', 'f/11'];
      validApertures.forEach(aperture => {
        v3Data.promptBlueprint.metadata.cameraSetting.physical = { aperture };
        expect(() => CineGeniusV3PromptSchema.parse(v3Data)).not.toThrow();
      });
      
      // Invalid aperture values
      const invalidApertures = ['1.4', 'f1.4', 'f/1.4f', 'wide open'];
      invalidApertures.forEach(aperture => {
        v3Data.promptBlueprint.metadata.cameraSetting.physical = { aperture };
        expect(() => CineGeniusV3PromptSchema.parse(v3Data)).toThrow();
      });
    });
    
    test('validates timeline sequence uniqueness', () => {
      const v3Data = createV3Example();
      
      // Duplicate sequence numbers should fail
      v3Data.promptBlueprint.timeline = [
        {
          sequence: 0,
          timestamp: '00:00:00.000',
          visualDirecting: 'Scene 1',
          cameraWork: { angle: 'Wide Shot (WS)', move: 'Static Shot' },
          pacingFX: { pacing: 'Real-time', editingStyle: 'Standard Cut', visualEffect: 'None' },
          audioLayers: { diegetic: '', non_diegetic: '', voice: '', concept: '' },
        },
        {
          sequence: 0, // Duplicate!
          timestamp: '00:00:02.000',
          visualDirecting: 'Scene 2',
          cameraWork: { angle: 'Close Up (CU)', move: 'Pan (Left/Right)' },
          pacingFX: { pacing: 'Real-time', editingStyle: 'Standard Cut', visualEffect: 'None' },
          audioLayers: { diegetic: '', non_diegetic: '', voice: '', concept: '' },
        },
      ];
      
      expect(() => CineGeniusV3PromptSchema.parse(v3Data)).toThrow();
    });
    
    test('validates continuity rules (noCuts constraint)', () => {
      const v3Data = createV3Example();
      
      // Set noCuts to true
      v3Data.promptBlueprint.metadata.continuity = { noCuts: true };
      
      // Forbidden editing styles when noCuts is true
      v3Data.promptBlueprint.timeline[0].pacingFX.editingStyle = 'Jump Cut';
      expect(() => CineGeniusV3PromptSchema.parse(v3Data)).toThrow();
      
      // Allowed editing styles when noCuts is true
      v3Data.promptBlueprint.timeline[0].pacingFX.editingStyle = 'Standard Cut';
      expect(() => CineGeniusV3PromptSchema.parse(v3Data)).not.toThrow();
    });
  });
  
  // =============================================================================
  // 🔄 Migration Tests
  // =============================================================================
  
  describe('Data Migration', () => {
    test('migrates v2.x to v3.1 successfully', () => {
      const v2Data = {
        metadata: {
          prompt_name: 'Legacy Project',
          base_style: 'Cinematic',
          aspect_ratio: '16:9',
          room_description: 'A futuristic cityscape',
          camera_setup: '35mm lens',
        },
        key_elements: ['hero', 'villain'],
        assembled_elements: ['skyscraper', 'flying car'],
        timeline: [
          {
            sequence: 0,
            timestamp: '00:00-00:03',
            action: 'Hero looks out over the city',
            audio: 'Epic orchestral music',
          },
          {
            sequence: 1,
            timestamp: '00:03-00:06',
            action: 'Flying car approaches',
            audio: 'Engine humming',
          },
        ],
        text: 'A cinematic scene of a futuristic city',
        keywords: ['futuristic', 'city', 'hero', 'epic'],
        negative_prompts: ['blurry', 'low quality'],
      };
      
      const migratedData = migrateV2ToV3(v2Data);
      
      // Should be valid v3.1 data
      expect(() => CineGeniusV3PromptSchema.parse(migratedData)).not.toThrow();
      
      // Should preserve essential data
      expect(migratedData.version).toBe('3.1');
      expect(migratedData.promptBlueprint.metadata.promptName).toBe('Legacy Project');
      expect(migratedData.promptBlueprint.metadata.baseStyle.visualStyle).toBe('Cinematic');
      expect(migratedData.promptBlueprint.timeline).toHaveLength(2);
      expect(migratedData.finalOutput.negativePrompts).toEqual(['blurry', 'low quality']);
    });
    
    test('handles empty/minimal v2.x data gracefully', () => {
      const minimalV2Data = {
        metadata: {
          prompt_name: 'Minimal',
          base_style: 'Simple',
          aspect_ratio: '16:9',
          room_description: 'Empty room',
          camera_setup: 'Standard',
        },
        key_elements: [],
        assembled_elements: [],
        timeline: [],
        text: '',
        keywords: [],
      };
      
      expect(() => {
        const migrated = migrateV2ToV3(minimalV2Data);
        CineGeniusV3PromptSchema.parse(migrated);
      }).not.toThrow();
    });
    
    test('fails migration for completely invalid v2.x data', () => {
      const invalidV2Data = {
        // Missing required fields
        metadata: {},
      };
      
      expect(() => migrateV2ToV3(invalidV2Data)).toThrow();
    });
  });
  
  // =============================================================================
  // 📊 Performance Tests
  // =============================================================================
  
  describe('Performance', () => {
    test('validates large v3.1 datasets within reasonable time', () => {
      const startTime = Date.now();
      
      // Create a large dataset
      const largeV3Data = createV3Example();
      largeV3Data.promptBlueprint.timeline = Array.from({ length: 100 }, (_, i) => ({
        sequence: i,
        timestamp: `00:${String(Math.floor(i * 2 / 60)).padStart(2, '0')}:${String(i * 2 % 60).padStart(2, '0')}.000`,
        visualDirecting: `Action sequence ${i}`,
        cameraWork: {
          angle: 'Medium Shot (MS)',
          move: 'Static Shot',
        },
        pacingFX: {
          pacing: 'Real-time',
          editingStyle: 'Standard Cut',
          visualEffect: 'None',
        },
        audioLayers: {
          diegetic: `Audio ${i}`,
          non_diegetic: '',
          voice: '',
          concept: '',
        },
      }));
      
      // Should validate quickly (under 1 second)
      expect(() => CineGeniusV3PromptSchema.parse(largeV3Data)).not.toThrow();
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
  
  // =============================================================================
  // 🔧 Edge Cases
  // =============================================================================
  
  describe('Edge Cases', () => {
    test('handles missing optional fields gracefully', () => {
      const v3Data = createV3Example();
      
      // Remove optional fields
      delete v3Data.promptBlueprint.metadata.continuity;
      delete v3Data.promptBlueprint.metadata.lookDev;
      delete v3Data.promptBlueprint.metadata.cameraPlan;
      delete v3Data.promptBlueprint.audioDesign;
      delete v3Data.aiAnalysis;
      delete v3Data.uiHints;
      
      expect(() => CineGeniusV3PromptSchema.parse(v3Data)).not.toThrow();
    });
    
    test('validates extreme but valid values', () => {
      const v3Data = createV3Example();
      
      // Extreme but valid values
      v3Data.promptBlueprint.metadata.deliverySpec.durationMs = 1; // Minimum
      v3Data.promptBlueprint.metadata.deliverySpec.fps = 240; // Maximum
      v3Data.promptBlueprint.metadata.cameraSetting.physical = {
        iso: 204800, // Maximum ISO
        aperture: 'f/32', // Very small aperture
      };
      
      expect(() => CineGeniusV3PromptSchema.parse(v3Data)).not.toThrow();
    });
    
    test('rejects values outside valid ranges', () => {
      const v3Data = createV3Example();
      
      // Out of range values
      v3Data.promptBlueprint.metadata.deliverySpec.durationMs = 0; // Below minimum
      expect(() => CineGeniusV3PromptSchema.parse(v3Data)).toThrow();
      
      v3Data.promptBlueprint.metadata.deliverySpec.durationMs = 8000; // Reset to valid
      v3Data.promptBlueprint.metadata.deliverySpec.fps = 300; // Above maximum
      expect(() => CineGeniusV3PromptSchema.parse(v3Data)).toThrow();
    });
  });
});
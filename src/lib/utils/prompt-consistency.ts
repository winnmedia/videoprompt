/**
 * Prompt Consistency Utilities
 * 
 * Ensures character, environment, and tone consistency across all storyboard shots
 */

export interface StoryboardConfig {
  character: {
    name: string;
    appearance: string;
    clothing: string;
    age?: string;
    personality?: string;
  };
  environment: {
    setting: string;
    time: string;
    atmosphere: string;
    details?: string;
  };
  style: {
    tone: string;
    lighting: string;
    mood: string;
    cinematography?: string;
  };
}

export interface ShotPromptOptions {
  type: 'wide' | 'medium' | 'close-up' | 'over-shoulder' | 'two-shot' | 'insert' | 'establishing' | 'detail';
  action: string;
  emotion?: string;
  cameraAngle?: string;
  additionalDetails?: string;
}

/**
 * Generate a consistent prompt for a shot based on the storyboard configuration
 */
export function generateConsistentPrompt(
  config: StoryboardConfig,
  shot: ShotPromptOptions
): string {
  const { character, environment, style } = config;
  
  // Build character description
  const characterDesc = `${character.name} (${character.appearance}, wearing ${character.clothing})`;
  
  // Build environment description
  const environmentDesc = `${environment.setting} during ${environment.time}, ${environment.atmosphere}`;
  
  // Build style description
  const styleDesc = `${style.tone}, ${style.lighting}, ${style.mood}`;
  
  // Map shot types to descriptive prefixes
  const shotTypeMap: Record<ShotPromptOptions['type'], string> = {
    'wide': 'Wide establishing shot',
    'medium': 'Medium shot',
    'close-up': 'Close-up shot',
    'over-shoulder': 'Over-the-shoulder shot',
    'two-shot': 'Two-shot composition',
    'insert': 'Insert detail shot',
    'establishing': 'Establishing shot',
    'detail': 'Detail shot'
  };
  
  // Construct the full prompt
  let prompt = `${shotTypeMap[shot.type]}: ${characterDesc} ${shot.action}`;
  
  if (shot.emotion) {
    prompt += `, showing ${shot.emotion}`;
  }
  
  prompt += `, in ${environmentDesc}`;
  
  if (shot.cameraAngle) {
    prompt += `, ${shot.cameraAngle}`;
  }
  
  prompt += `, ${styleDesc}`;
  
  if (shot.additionalDetails) {
    prompt += `, ${shot.additionalDetails}`;
  }
  
  // Add technical specs for better consistency
  prompt += ', cinematic quality, consistent character design, highly detailed';
  
  return prompt;
}

/**
 * Extract configuration from a story description
 */
export function extractStoryboardConfig(
  storyDescription: string,
  genre?: string
): StoryboardConfig {
  // Default configurations based on common genres
  const genreDefaults: Record<string, Partial<StoryboardConfig>> = {
    'SF': {
      environment: {
        setting: 'futuristic city',
        time: 'night',
        atmosphere: 'neon-lit cyberpunk'
      },
      style: {
        tone: 'sci-fi cinematic',
        lighting: 'neon and holographic lighting',
        mood: 'dystopian atmosphere'
      }
    },
    '판타지': {
      environment: {
        setting: 'magical realm',
        time: 'twilight',
        atmosphere: 'mystical and ethereal'
      },
      style: {
        tone: 'fantasy epic',
        lighting: 'golden hour magical lighting',
        mood: 'enchanted atmosphere'
      }
    },
    '로맨스': {
      environment: {
        setting: 'cozy urban setting',
        time: 'golden hour',
        atmosphere: 'warm and intimate'
      },
      style: {
        tone: 'romantic drama',
        lighting: 'soft natural lighting',
        mood: 'emotional and heartfelt'
      }
    },
    '스릴러': {
      environment: {
        setting: 'urban shadows',
        time: 'night',
        atmosphere: 'tense and mysterious'
      },
      style: {
        tone: 'thriller noir',
        lighting: 'dramatic contrast lighting',
        mood: 'suspenseful atmosphere'
      }
    }
  };
  
  // Extract character info from story (simplified - in production, use NLP)
  const defaultCharacter = {
    name: 'the protagonist',
    appearance: 'determined expression',
    clothing: 'contemporary outfit'
  };
  
  // Get genre defaults or use neutral defaults
  const genreConfig = genre && genreDefaults[genre] 
    ? genreDefaults[genre] 
    : {
        environment: {
          setting: 'modern city',
          time: 'day',
          atmosphere: 'realistic urban'
        },
        style: {
          tone: 'cinematic',
          lighting: 'natural lighting',
          mood: 'dramatic atmosphere'
        }
      };
  
  return {
    character: defaultCharacter,
    environment: genreConfig.environment as StoryboardConfig['environment'],
    style: genreConfig.style as StoryboardConfig['style']
  };
}

/**
 * Validate that a prompt includes all necessary consistency elements
 */
export function validatePromptConsistency(prompt: string): {
  isValid: boolean;
  missingElements: string[];
} {
  const requiredElements = [
    { key: 'character', patterns: ['wearing', 'appearance', 'protagonist'] },
    { key: 'environment', patterns: ['setting', 'during', 'in '] },
    { key: 'style', patterns: ['lighting', 'atmosphere', 'cinematic'] },
    { key: 'shot_type', patterns: ['shot', 'composition', 'angle'] }
  ];
  
  const missingElements: string[] = [];
  
  for (const element of requiredElements) {
    const hasElement = element.patterns.some(pattern => 
      prompt.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (!hasElement) {
      missingElements.push(element.key);
    }
  }
  
  return {
    isValid: missingElements.length === 0,
    missingElements
  };
}

/**
 * Generate a batch of consistent prompts for a complete storyboard
 */
export function generateStoryboardPrompts(
  config: StoryboardConfig,
  shots: Array<{ description: string; type?: ShotPromptOptions['type'] }>
): string[] {
  return shots.map((shot, index) => {
    // Parse action from description
    const action = shot.description || `in scene ${index + 1}`;
    
    // Determine shot type based on position if not specified
    const shotTypes: ShotPromptOptions['type'][] = [
      'establishing', 'wide', 'medium', 'close-up', 'medium', 
      'over-shoulder', 'two-shot', 'close-up', 'medium', 
      'detail', 'wide', 'close-up'
    ];
    
    const shotType = shot.type || shotTypes[index % shotTypes.length];
    
    return generateConsistentPrompt(config, {
      type: shotType,
      action: action
    });
  });
}

/**
 * Enhance an existing prompt with consistency elements
 */
export function enhancePromptWithConsistency(
  originalPrompt: string,
  config: StoryboardConfig
): string {
  const validation = validatePromptConsistency(originalPrompt);
  
  if (validation.isValid) {
    return originalPrompt;
  }
  
  let enhancedPrompt = originalPrompt;
  
  // Add missing character details
  if (validation.missingElements.includes('character')) {
    const characterDesc = `${config.character.name} (${config.character.appearance}, wearing ${config.character.clothing})`;
    enhancedPrompt = `${characterDesc} in ${enhancedPrompt}`;
  }
  
  // Add missing environment
  if (validation.missingElements.includes('environment')) {
    enhancedPrompt += `, ${config.environment.setting} during ${config.environment.time}`;
  }
  
  // Add missing style
  if (validation.missingElements.includes('style')) {
    enhancedPrompt += `, ${config.style.tone}, ${config.style.lighting}`;
  }
  
  return enhancedPrompt;
}
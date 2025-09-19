import { ScenePrompt } from '@/shared/types/api';
import {
  translateKoreanToEnglish,
  translateArray,
  translateWizardContextToEnglish,
} from '@/lib/i18n';
import type { WizardLikeContext } from '@/lib/i18n';

// Accept a loose Wizard-like context (some fields optional) and normalize inside
type WizardContextInput = WizardLikeContext;

const joinList = (items?: string[] | null, fallback = 'none') => {
  if (!items || items.length === 0) return fallback;
  return items.join(', ');
};

function translateCameraKoreanToEnglish(label?: string): string | undefined {
  if (!label) return label;
  const map: Record<string, string> = {
    와이드: 'wide',
    따라가기: 'tracking',
    POV: 'POV',
    탑뷰: 'top view',
    돌리인: 'dolly-in',
    롱테이크: 'long take',
    핸드헬드: 'handheld',
    '드론 오비탈': 'drone orbital',
  };
  return map[label] || label;
}

export function buildVeo3PromptFromWizard(ctx: WizardContextInput): string {
  // Ensure categorical fields are English even if caller skipped translation
  const eng = translateWizardContextToEnglish(ctx);
  const {
    scenario = '',
    theme = '',
    style = '',
    aspectRatio = '16:9',
    durationSec = 2,
    targetAudience = 'general',
    mood = '',
    camera = '',
    weather = '',
    characters,
    actions,
    enhancedPrompt,
    suggestions,
  } = eng as any;

  // Read optional cinematic parameters if provided by caller
  const resolution: string | undefined = (eng as any)?.resolution;
  const fps: string | undefined = (eng as any)?.fps;
  const genre: string | undefined = (eng as any)?.genre;
  const visualTone: string | undefined = (eng as any)?.visualTone;
  const cameraMovement: string | undefined = (eng as any)?.cameraMovement;
  const shotType: string | undefined = (eng as any)?.shotType;
  const speed: string | undefined = (eng as any)?.speed;
  const lighting: string | undefined = (eng as any)?.lighting;
  const colorPalette: string | undefined = (eng as any)?.colorPalette;
  const soundAmbience: string | undefined = (eng as any)?.soundAmbience;
  const sfxDensity: string | undefined = (eng as any)?.sfxDensity;
  const safetyPreset: string | undefined = (eng as any)?.safetyPreset;
  const detailStrength: string | undefined = (eng as any)?.detailStrength;
  const motionSmoothing: string | undefined = (eng as any)?.motionSmoothing;
  const coherence: string | undefined = (eng as any)?.coherence;
  const randomness: string | undefined = (eng as any)?.randomness;
  const seed: string | number | undefined = (eng as any)?.seed;

  // keep original text; upstream i18n handles translation
  const toEnglish = (text?: string) => text || '';
  const description = enhancedPrompt && enhancedPrompt.trim() ? enhancedPrompt : scenario;
  const keywords = suggestions && suggestions.length > 0 ? suggestions : [];

  return [
    // System goal
    'Create a high-quality cinematic video with Google Veo 3.',
    '',
    // Tech specs
    `Aspect: ${aspectRatio} | Duration: ${durationSec}s | Quality: ultra | Resolution: ${resolution || '4K'}${fps ? ` | FPS: ${fps}` : ''}`,
    `Style: ${toEnglish(style)} | Mood: ${toEnglish(mood) || 'default'} | Camera: ${translateCameraKoreanToEnglish(camera) || 'default'} | Weather: ${toEnglish(weather) || 'default'}`,
    `Target Audience: ${targetAudience || 'general'}`,
    genre ? `Genre: ${toEnglish(genre)}` : undefined,
    visualTone ? `Visual Tone: ${toEnglish(visualTone)}` : undefined,
    '',
    // Core description
    `Scene Theme: ${toEnglish(theme)}`,
    `Scene Description: ${toEnglish(description)}`,
    '',
    // Cinematography & Look
    cameraMovement || shotType
      ? `Cinematography: ${[cameraMovement, shotType].filter(Boolean).map(toEnglish).join(', ')}`
      : undefined,
    lighting ? `Lighting: ${toEnglish(lighting)}` : undefined,
    colorPalette ? `Color Palette: ${toEnglish(colorPalette)}` : undefined,
    soundAmbience ? `Sound Ambience: ${toEnglish(soundAmbience)}` : undefined,
    sfxDensity ? `SFX Density: ${toEnglish(sfxDensity)}` : undefined,
    safetyPreset ? `Safety Preset: ${toEnglish(safetyPreset)}` : undefined,
    detailStrength || motionSmoothing || coherence || randomness
      ? `Technical: ${[
          detailStrength && `detail=${toEnglish(detailStrength)}`,
          motionSmoothing && `motion=${toEnglish(motionSmoothing)}`,
          coherence && `coherence=${toEnglish(coherence)}`,
          randomness && `randomness=${toEnglish(randomness)}`,
        ]
          .filter(Boolean)
          .join(', ')}`
      : undefined,
    seed !== undefined && seed !== '' ? `Seed: ${seed}` : undefined,
    '',
    // Elements
    `Characters: ${joinList(characters, 'none')}`,
    `Actions: ${joinList(actions, 'none')}`,
    keywords.length ? `Keywords: ${joinList(keywords)}` : undefined,
    '',
    // Camera & timing guidance (lightweight)
    'Camera Directions:',
    '- Use natural camera movement matching the mood and style.',
    '- Ensure visual clarity with coherent lighting and color palette.',
    '',
    'Output: a single cohesive shot that fits the requested duration and aspect.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildVeo3PromptFromScene(scene: ScenePrompt): string {
  const m = (scene as any).metadata || {};
  const theme = m.room_description || 'N/A';
  const style = m.base_style || 'N/A';
  const aspect = m.aspect_ratio || '16:9';
  const camera = translateCameraKoreanToEnglish(m.camera_setup) || 'default';
  const duration =
    Array.isArray(scene.timeline) && scene.timeline.length > 0
      ? (() => {
          try {
            const t = scene.timeline[0].timestamp || '00:00-00:02';
            const parts = t.split('-')[1] || '00:02';
            const [mm, ss] = parts.split(':').map((v) => parseInt(v, 10));
            return mm * 60 + ss || 2;
          } catch {
            return 2;
          }
        })()
      : 2;

  const description =
    scene.text && scene.text !== 'none' ? String(scene.text) : scene.assembled_elements?.[0] || '';
  const keywords = Array.isArray(scene.keywords) ? scene.keywords : [];

  return [
    'Create a high-quality cinematic video with Google Veo 3.',
    '',
    `Aspect: ${aspect} | Duration: ${duration}s | Quality: ultra | Resolution: 4K`,
    `Style: ${style} | Camera: ${camera}`,
    '',
    `Scene Theme: ${theme}`,
    `Scene Description: ${description}`,
    keywords.length ? `Keywords: ${keywords.join(', ')}` : undefined,
    '',
    'Camera Directions:',
    '- Use natural camera movement matching the mood and style.',
    '- Ensure visual clarity with coherent lighting and color palette.',
    '',
    'Output: a single cohesive shot that fits the requested duration and aspect.',
  ]
    .filter(Boolean)
    .join('\n');
}

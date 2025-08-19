import { ScenePrompt } from '@/types/api';
import { translateKoreanToEnglish, translateArray, translateWizardContextToEnglish } from '@/lib/i18n';

interface WizardContext {
  scenario: string;
  theme: string;
  style: string;
  aspectRatio: string;
  durationSec: number;
  targetAudience?: string;
  mood?: string;
  camera?: string;
  weather?: string;
  characters?: string[];
  actions?: string[];
  enhancedPrompt?: string;
  suggestions?: string[];
}

const joinList = (items?: string[] | null, fallback = 'none') => {
  if (!items || items.length === 0) return fallback;
  return items.join(', ');
};

function translateCameraKoreanToEnglish(label?: string): string | undefined {
  if (!label) return label;
  const map: Record<string, string> = {
    '와이드': 'wide',
    '따라가기': 'tracking',
    'POV': 'POV',
    '탑뷰': 'top view',
    '돌리인': 'dolly-in',
    '롱테이크': 'long take',
    '핸드헬드': 'handheld',
    '드론 오비탈': 'drone orbital',
  };
  return map[label] || label;
}

export function buildVeo3PromptFromWizard(ctx: WizardContext): string {
  // Ensure categorical fields are English even if caller skipped translation
  const eng = translateWizardContextToEnglish(ctx);
  const {
    scenario,
    theme,
    style,
    aspectRatio,
    durationSec,
    targetAudience,
    mood,
    camera,
    weather,
    characters,
    actions,
    enhancedPrompt,
    suggestions,
  } = eng as WizardContext;

  // keep original text; upstream i18n handles translation
  const toEnglish = (text?: string) => text || '';
  const description = (enhancedPrompt && enhancedPrompt.trim()) ? enhancedPrompt : scenario;
  const keywords = suggestions && suggestions.length > 0 ? suggestions : [];

  return [
    // System goal
    'Create a high-quality cinematic video with Google Veo 3.',
    '',
    // Tech specs
    `Aspect: ${aspectRatio} | Duration: ${durationSec}s | Quality: ultra | Resolution: 4K`,
    `Style: ${toEnglish(style)} | Mood: ${toEnglish(mood) || 'default'} | Camera: ${translateCameraKoreanToEnglish(camera) || 'default'} | Weather: ${toEnglish(weather) || 'default'}`,
    `Target Audience: ${targetAudience || 'general'}`,
    '',
    // Core description
    `Scene Theme: ${toEnglish(theme)}`,
    `Scene Description: ${toEnglish(description)}`,
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
  ].filter(Boolean).join('\n');
}

export function buildVeo3PromptFromScene(scene: ScenePrompt): string {
  const m = (scene as any).metadata || {};
  const theme = m.room_description || 'N/A';
  const style = m.base_style || 'N/A';
  const aspect = m.aspect_ratio || '16:9';
  const camera = translateCameraKoreanToEnglish(m.camera_setup) || 'default';
  const duration = Array.isArray(scene.timeline) && scene.timeline.length > 0
    ? (() => {
        try {
          const t = scene.timeline[0].timestamp || '00:00-00:02';
          const parts = t.split('-')[1] || '00:02';
          const [mm, ss] = parts.split(':').map((v) => parseInt(v, 10));
          return (mm * 60 + ss) || 2;
        } catch {
          return 2;
        }
      })()
    : 2;

  const description = scene.text && scene.text !== 'none' ? String(scene.text) : (scene.assembled_elements?.[0] || '');
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
  ].filter(Boolean).join('\n');
}



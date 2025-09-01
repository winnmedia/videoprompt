import type { ScenePrompt, TimelineElement } from '@/types/api';
import { PROFILES } from '@/lib/presets/profiles';
import { buildTimeline } from '@/lib/timeline/build';
import { normalizeNegatives } from '@/lib/policy/negative';

export function composeSceneFromProfile(profileIdx: number): ScenePrompt {
  const p = PROFILES[profileIdx];
  const timeline: TimelineElement[] = buildTimeline(p.durationSec, 'full').map((b, i) => ({
    sequence: i + 1,
    timestamp: b.timestamp,
    action: [
      'Wide establishing: setting and subject under mood.',
      'Inciting event introduces tension and reaction.',
      'Pursuit or core action escalates visibly.',
      'Resolution beat with a strong visual punctuation.',
    ][Math.min(i, 3)],
    audio: [
      'Heavy ambient bed with surface details',
      'Shouts, impacts, sharp SFX',
      'Footsteps, metal clanks, wind gusts',
      'Chopper blades/spotlight hum/low bass swell',
    ][Math.min(i, 3)],
  }));

  return {
    metadata: {
      prompt_name: p.name,
      base_style: p.baseStyle,
      aspect_ratio: '21:9',
      room_description: p.buildRoomDescription(),
      camera_setup: p.buildCameraSetup(),
    },
    key_elements: [],
    assembled_elements: [],
    negative_prompts: normalizeNegatives(p.negatives),
    timeline,
    text: 'none',
    keywords: p.keywordSeeds,
  } as unknown as ScenePrompt;
}

export function composeFourScenePack(): ScenePrompt[] {
  return [0, 1, 2, 3].map(composeSceneFromProfile);
}

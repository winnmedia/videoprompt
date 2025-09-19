import type { ScenePrompt } from '@/shared/types/api';

const SEP = '—'.repeat(109);

export function formatSceneJson(scene: ScenePrompt): string {
  // stringify with stable spacing
  return JSON.stringify(scene, null, 2);
}

export function composeFinalTextSingle(scene: ScenePrompt): string {
  return ['CINEMATIC MOVIE PROMPTS', '', 'SCENE 1', '', formatSceneJson(scene)].join('\n\n');
}

export function composeFinalTextMulti(scenes: ScenePrompt[]): string {
  const parts: string[] = [];
  parts.push('CINEMATIC MOVIE PROMPTS');
  parts.push('');
  scenes.forEach((scene, idx) => {
    parts.push(`SCENE ${idx + 1}`);
    parts.push('');
    parts.push(formatSceneJson(scene));
    if (idx < scenes.length - 1) {
      parts.push('');
      parts.push(SEP);
      parts.push('');
    }
  });
  return parts.join('\n');
}

import type { ScenePrompt } from '@/types/api';

const SEP = '—'.repeat(109);

export function formatSceneJson(scene: ScenePrompt): string {
  // stringify with stable spacing
  return JSON.stringify(scene, null, 2);
}

export function composeFinalTextSingle(scene: ScenePrompt): string {
  return `CINEMATIC MOVIE PROMPTS\nSCENE 1\n${formatSceneJson(scene)}`;
}

export function composeFinalTextMulti(scenes: ScenePrompt[]): string {
  const parts: string[] = [];
  parts.push('CINEMATIC MOVIE PROMPTS');
  scenes.forEach((scene, idx) => {
    parts.push(`SCENE ${idx + 1}`);
    parts.push(formatSceneJson(scene));
    if (idx < scenes.length - 1) parts.push(SEP);
  });
  return parts.join(' ');
}



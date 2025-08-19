export type CameraBeat = 'intro' | 'incite' | 'pursue' | 'resolve';

const KOREAN_TO_EN_CAMERA: Record<string, string> = {
  '와이드': 'wide',
  '따라가기': 'tracking',
  'POV': 'POV',
  '탑뷰': 'top view',
  '돌리인': 'dolly-in',
  '롱테이크': 'long take',
  '핸드헬드': 'handheld',
  '드론 오비탈': 'drone orbital',
};

export function mapCameraToEnglish(label?: string): string | undefined {
  if (!label) return label;
  return KOREAN_TO_EN_CAMERA[label] || label;
}

export function parseCameraBeatsForGenre(genre: string): CameraBeat[] {
  // Simple genre-based defaults
  if (genre.includes('thriller') || genre.includes('action')) {
    return ['intro', 'incite', 'pursue', 'resolve'];
  }
  return ['intro', 'resolve'];
}

export function finalizeCameraSetup(beats: CameraBeat[]): string {
  const steps: string[] = [];
  for (const beat of beats) {
    if (beat === 'intro') steps.push('slow dolly-in');
    if (beat === 'incite') steps.push('handheld');
    if (beat === 'pursue') steps.push('tracking');
    if (beat === 'resolve') steps.push('pan up');
  }
  return steps.join(' → ');
}



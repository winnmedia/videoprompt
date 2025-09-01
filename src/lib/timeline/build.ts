export interface TimelineElement {
  sequence: number;
  timestamp: string;
  action: string;
  audio: string;
}

export type SfxMode = 'full' | 'lite';

const ACTION_BEATS = [
  'establish setting and subject',
  'inciting event, panic rises',
  'pursuit/core action escalates',
  'resolution with strong visual punctuation',
];
const SFX_FULL = [
  'ambient bed, surface details, subtle foley',
  'shouts, impacts, sharp SFX',
  'footsteps, metal clanks, wind gusts',
  'spotlight hum, distant siren, low bass swell',
];
const SFX_LITE = ['ambient', 'impact', 'movement', 'resolve'];

export function buildTimeline(durationSec: number, mode: SfxMode = 'full'): TimelineElement[] {
  const cuts = Math.max(1, Math.floor(durationSec / 2));
  const out: TimelineElement[] = [];
  for (let i = 0; i < cuts; i++) {
    const seq = i + 1;
    const start = String(i * 2).padStart(2, '0');
    const end = String(i * 2 + 2).padStart(2, '0');
    const action = ACTION_BEATS[Math.min(i, ACTION_BEATS.length - 1)];
    const audio = (mode === 'full' ? SFX_FULL : SFX_LITE)[Math.min(i, SFX_FULL.length - 1)];
    out.push({ sequence: seq, timestamp: `00:${start}-00:${end}`, action, audio });
  }
  return out;
}

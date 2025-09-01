export type SceneProfile = {
  name: string;
  baseStyle: string;
  negatives: string[];
  keywordSeeds: string[];
  buildRoomDescription: () => string;
  buildCameraSetup: () => string;
  durationSec: number;
};

export const PROFILES: SceneProfile[] = [
  {
    name: 'Rooftop Deal Gone Wrong - Full SFX',
    baseStyle: 'cinematic, photorealistic, action-thriller, 4K',
    negatives: [
      'no blood',
      'no supernatural elements',
      'no text',
      'no daytime or sun',
      'no sci-fi weapons',
    ],
    keywordSeeds: [
      'rooftop action',
      'briefcase exchange',
      'sniper ambush',
      'gunfight escape',
      'rain cinematic',
      'helicopter chase',
      'thriller SFX',
      'Veo 3 movie trailer style',
    ],
    buildRoomDescription: () =>
      'Dimly lit urban rooftop at night, glistening wet from rain. Antennas blink red. Foggy city skyline glows in the distance, with distant lightning occasionally illuminating the scene.',
    buildCameraSetup: () =>
      'Starts with slow dolly-in on the deal, then transitions to shaky handheld-style cam as action explodes. Ends with quick pan up to helicopter light overhead.',
    durationSec: 8,
  },
  {
    name: 'Garage Escape - Minimal Cinematic Veo 3',
    baseStyle: 'cinematic, photorealistic, noir-inspired',
    negatives: [
      'no glitches',
      'no floating objects',
      'no fast movement',
      'no unrealistic lighting',
      'no characters outside of frame',
    ],
    keywordSeeds: [
      'garage escape',
      'Veo 3 cinematic',
      'slow realism',
      'wet floor reflection',
      'underground hideout',
      'car stealth',
      'subtle tension',
    ],
    buildRoomDescription: () =>
      "Low-lit underground parking garage at night. Sparse fluorescent lights. Rainwater puddles on the floor. One sleek car parked with driver's door ajar.",
    buildCameraSetup: () =>
      'Single slow tracking shot from left to right, staying low and wide behind a concrete pillar, revealing the escape.',
    durationSec: 8,
  },
  {
    name: 'Scene 3 - POV Supercar Tunnel Chase',
    baseStyle: 'cinematic, photorealistic, gritty action POV, 4K',
    negatives: [
      'no unrealistic vehicle designs',
      'no floating objects',
      'no futuristic sci-fi tech',
      'no overexposed colors',
    ],
    keywordSeeds: [
      'POV car chase',
      'supercar interior',
      'side mirror gunfire',
      'cinematic realism',
      'Veo 3 action shot',
      'tunnel environment',
      'G-Wagon pursuit',
      'high-speed driving',
      'first-person thrill',
    ],
    buildRoomDescription: () =>
      'Narrow underground tunnel with flickering lights, graffiti walls, wet floor, and echoing acoustics. The supercar interior is sleek, dark leather with digital dashboard lit up.',
    buildCameraSetup: () =>
      'First-person POV from the driver’s seat, hands on the wheel, wide lens with occasional side-mirror glances.',
    durationSec: 8,
  },
  {
    name: 'Scene 4 - Burnout and Escape',
    baseStyle: 'cinematic, grounded thriller, 4K realistic lighting',
    negatives: [
      'no overcomplicated action',
      'no unrealistic flips or explosions',
      'no cartoon style',
      'no daytime',
    ],
    keywordSeeds: [
      'foggy chase escape',
      'burnout scene',
      'briefcase thriller',
      'minimalist cinematic motion',
      'Veo 3 story',
      'warehouse zone',
      'nighttime thriller',
      'clean tracking shot',
    ],
    buildRoomDescription: () =>
      'Foggy abandoned warehouse district at night, dim orange street lights, cracked asphalt, distant sirens, light smoke in the air.',
    buildCameraSetup: () =>
      'Starts with low side view of car burnout, shifts to dolly following hero’s sprint from behind.',
    durationSec: 8,
  },
];

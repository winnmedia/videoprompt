// Build an image-oriented prompt (static composition) from Wizard context
// Focus on: subject, composition, lens, lighting, color, environment, style, negatives

export type ImagenPromptInput = {
  title?: string;
  description?: string; // enhancedPrompt or scenario
  theme?: string;
  style?: string;
  mood?: string;
  camera?: string; // e.g., dolly-in, POV → mapped to static framing words
  shotType?: string; // wide, medium, close-up
  cameraMovement?: string; // ignored or softened for stills
  lighting?: string;
  colorPalette?: string;
  weather?: string;
  visualTone?: string;
  genre?: string;
  characters?: string[];
  actions?: string[]; // used sparsely; convert to pose/static hints
  aspectRatio?: string; // e.g., 16:9
  negativePrompts?: string[];
  keywords?: string[];
};

function join(items?: Array<string | undefined | null>, sep = ', '): string {
  return (items || []).filter(Boolean).map(String).map(s => s.trim()).filter(Boolean).join(sep);
}

function softenMotion(camera?: string, movement?: string): string | undefined {
  const tags: string[] = [];
  const norm = (s?: string) => (s || '').toLowerCase();
  const c = norm(camera);
  const m = norm(movement);
  if (c.includes('pov')) tags.push('eye-level POV framing');
  if (c.includes('wide')) tags.push('wide composition');
  if (c.includes('close')) tags.push('tight close-up framing');
  if (c.includes('top') || c.includes('over')) tags.push('top/over-shoulder framing');
  if (m.includes('dolly') || m.includes('tracking') || m.includes('handheld')) tags.push('static capture, no motion blur');
  return tags.length ? join(tags) : undefined;
}

function mapShotType(shot?: string): string | undefined {
  const s = (shot || '').toLowerCase();
  if (!s) return undefined;
  if (s.includes('wide')) return 'wide shot';
  if (s.includes('medium')) return 'medium shot';
  if (s.includes('close')) return 'close-up shot';
  if (s.includes('over-shoulder')) return 'over-the-shoulder composition';
  if (s.includes('top') || s.includes('top-down')) return 'top-down shot';
  if (s.includes('pov')) return 'POV composition';
  return shot;
}

export function buildImagenPrompt(input: ImagenPromptInput): string {
  const aspect = input.aspectRatio || '16:9';
  const subject = input.title || input.theme || 'cinematic scene';
  const core = input.description || '';
  const staticCam = softenMotion(input.camera, input.cameraMovement);
  const shot = mapShotType(input.shotType);
  const mood = input.mood || input.visualTone || input.style;
  const env = join([input.theme, input.weather], ', ');
  const look = join([input.style, input.visualTone], ', ');
  const chars = (input.characters && input.characters.length) ? `Subjects: ${join(input.characters)}` : undefined;
  const kws = (input.keywords && input.keywords.length) ? `Keywords: ${join(input.keywords)}` : undefined;
  const negatives = (input.negativePrompts && input.negativePrompts.length)
    ? `Negative: ${join(input.negativePrompts)}`
    : undefined;

  return [
    // Header
    `High-quality cinematic image, photorealistic, ${aspect} aspect`,
    // Subject & description
    `Subject: ${subject}`,
    core ? `Description: ${core}` : undefined,
    // Composition
    join([shot, staticCam], ' | '),
    // Lighting & color
    input.lighting ? `Lighting: ${input.lighting}` : undefined,
    input.colorPalette ? `Color Grading: ${input.colorPalette}` : undefined,
    // Mood & style
    mood ? `Mood/Style: ${mood}` : undefined,
    // Environment
    env ? `Environment: ${env}` : undefined,
    chars,
    kws,
    negatives,
    // Guidance
    'Details: sharp focus, natural skin tones, cinematic depth of field, film grain subtle',
    'Framing: rule of thirds, balanced composition, clean background',
  ].filter(Boolean).join('\n');
}



/**
 * Shot Converter - Scene을 VLANET Timeline으로 변환
 *
 * CLAUDE.md 준수: FSD features 레이어, 비즈니스 로직
 */

import type { Scene, Scenario } from '@/entities/scenario'
import type {
  VLANETPrompt,
  TimelineItem,
  CameraWork,
  PacingFX,
  AudioLayers,
  PromptMetadata,
  BaseStyle,
  SpatialContext,
  CameraSetting,
  DeliverySpec,
  Elements,
  Character,
  CoreObject,
} from '@/entities/prompt'
import { v4 as uuidv4 } from 'uuid'

/**
 * Scene을 VLANET TimelineItem으로 변환
 */
export function convertSceneToTimelineItem(
  scene: Scene,
  sequence: number
): TimelineItem {
  return {
    sequence,
    visualDirecting: generateVisualDirecting(scene),
    cameraWork: generateCameraWork(scene),
    pacingFX: generatePacingFX(scene),
    audioLayers: generateAudioLayers(scene),
    actionNote: scene.actionDescription || '',
    audioNote: scene.dialogue || '',
    visualNote: scene.notes || '',
    timecode: scene.duration
      ? {
          startMs: (sequence - 1) * (scene.duration * 1000),
          endMs: sequence * (scene.duration * 1000),
        }
      : undefined,
  }
}

/**
 * Scenario를 기반으로 VLANET 프롬프트 생성
 */
export function convertScenarioToVLANETPrompt(
  scenario: Scenario,
  selectedSceneIds: string[],
  customConfig?: Partial<VLANETPrompt>
): VLANETPrompt {
  const selectedScenes = scenario.scenes.filter((scene) =>
    selectedSceneIds.includes(scene.id)
  )

  if (selectedScenes.length === 0) {
    throw new Error('최소 하나의 씬을 선택해야 합니다.')
  }

  const timeline = selectedScenes.map((scene, index) =>
    convertSceneToTimelineItem(scene, index)
  )

  const elements = extractElementsFromScenes(selectedScenes)
  const metadata = generatePromptMetadata(scenario, selectedScenes)

  const totalDuration = selectedScenes.reduce(
    (sum, scene) => sum + (scene.duration || 10),
    0
  )

  return {
    version: '1.0',
    projectId: uuidv4(),
    createdAt: new Date().toISOString(),
    userInput: {
      oneLineScenario: scenario.storyOutline || scenario.metadata.description || '',
      targetAudience: 'General audience',
    },
    projectConfig: {
      creationMode: 'VISUAL_FIRST',
      frameworkType: 'EVENT_DRIVEN',
      aiAssistantPersona: 'ASSISTANT_DIRECTOR',
    },
    promptBlueprint: {
      metadata,
      elements,
      timeline,
    },
    generationControl: {
      directorEmphasis: generateDirectorEmphasis(scenario),
      shotByShot: {
        enabled: true,
        lockedSegments: [],
      },
      seed: Math.floor(Math.random() * 2147483647),
    },
    finalOutputCompact: generateCompactOutput(scenario, timeline, totalDuration),
    ...customConfig,
  }
}

/**
 * 비주얼 디렉팅 텍스트 생성
 */
function generateVisualDirecting(scene: Scene): string {
  const parts: string[] = []

  if (scene.location) {
    parts.push(`Location: ${scene.location}`)
  }

  parts.push(scene.description)

  if (scene.actionDescription) {
    parts.push(`Action: ${scene.actionDescription}`)
  }

  if (scene.visualElements && scene.visualElements.length > 0) {
    const visualDescs = scene.visualElements.map((ve) => ve.description).join(', ')
    parts.push(`Visual elements: ${visualDescs}`)
  }

  return parts.join('. ')
}

/**
 * 카메라 워크 생성 (Scene 타입에 따라)
 */
function generateCameraWork(scene: Scene): CameraWork {
  const cameraWorkMap: Record<string, Partial<CameraWork>> = {
    dialogue: {
      angle: 'Medium Shot (MS)',
      move: 'Static Shot',
      focus: 'Characters',
    },
    action: {
      angle: 'Wide Shot (WS)',
      move: 'Tracking (Follow)',
      focus: 'Action sequence',
    },
    transition: {
      angle: 'Wide Shot (WS)',
      move: 'Pan (Left/Right)',
      focus: 'Environment',
    },
    montage: {
      angle: 'Close Up (CU)',
      move: 'Dolly (In/Out)',
      focus: 'Detail',
    },
    voiceover: {
      angle: 'Medium Shot (MS)',
      move: 'Slow tracking',
      focus: 'Subject',
    },
  }

  const defaultCameraWork = cameraWorkMap[scene.type] || cameraWorkMap.dialogue

  return {
    angle: defaultCameraWork.angle as CameraWork['angle'],
    move: defaultCameraWork.move as CameraWork['move'],
    focus: defaultCameraWork.focus || 'Subject',
  }
}

/**
 * 페이싱 및 이펙트 생성
 */
function generatePacingFX(scene: Scene): PacingFX {
  const pacingMap: Record<string, PacingFX['pacing']> = {
    dialogue: 'Real-time',
    action: 'Fast-motion (2x)',
    transition: 'Slow-motion (0.5x)',
    montage: 'Real-time',
    voiceover: 'Real-time',
  }

  return {
    pacing: pacingMap[scene.type] || 'Real-time',
    editingStyle: scene.type === 'montage' ? 'Jump Cut' : 'Standard Cut',
    visualEffect: scene.type === 'action' ? 'Motion Blur' : 'None',
  }
}

/**
 * 오디오 레이어 생성
 */
function generateAudioLayers(scene: Scene): AudioLayers {
  const audioLayers: AudioLayers = {
    diegetic: '',
    non_diegetic: '',
    voice: '',
    concept: '',
  }

  // 대화가 있으면 voice 레이어에 추가
  if (scene.dialogue) {
    const character = scene.characters?.[0] || 'Character'
    audioLayers.voice = `${character}: ${scene.dialogue}`
  }

  // 액션 씬의 경우 SFX 추가
  if (scene.type === 'action') {
    audioLayers.diegetic = '[SFX: Action sounds, movement, impacts]'
  }

  // 전환 씬의 경우 배경음악 추가
  if (scene.type === 'transition') {
    audioLayers.non_diegetic = '[Music: Transition background music]'
  }

  return audioLayers
}

/**
 * Scenes에서 요소들 추출
 */
function extractElementsFromScenes(scenes: Scene[]): Elements {
  const characters: Character[] = []
  const coreObjects: CoreObject[] = []
  const characterSet = new Set<string>()
  const objectSet = new Set<string>()

  scenes.forEach((scene) => {
    // 캐릭터 추출
    scene.characters?.forEach((char) => {
      if (!characterSet.has(char)) {
        characterSet.add(char)
        characters.push({
          id: char.toLowerCase().replace(/\s+/g, '_'),
          description: char,
        })
      }
    })

    // 비주얼 요소에서 오브젝트 추출
    scene.visualElements?.forEach((element) => {
      if (!objectSet.has(element.description)) {
        objectSet.add(element.description)
        coreObjects.push({
          id: element.id,
          description: element.description,
          reference_image_url: element.url,
        })
      }
    })
  })

  return {
    characters,
    coreObjects,
  }
}

/**
 * 프롬프트 메타데이터 생성
 */
function generatePromptMetadata(
  scenario: Scenario,
  selectedScenes: Scene[]
): PromptMetadata {
  const totalDuration = selectedScenes.reduce(
    (sum, scene) => sum + (scene.duration || 10),
    0
  )

  const baseStyle: BaseStyle = {
    visualStyle: 'Cinematic',
    genre: scenario.metadata.genre || 'Drama',
    mood: inferMoodFromScenes(selectedScenes),
    quality: '4K',
    styleFusion: {
      styleA: 'Christopher Nolan',
      styleB: 'Denis Villeneuve',
      ratio: 0.5,
    },
  }

  const spatialContext: SpatialContext = {
    placeDescription: inferLocationFromScenes(selectedScenes),
    weather: 'Clear',
    lighting: 'Daylight (Midday)',
  }

  const cameraSetting: CameraSetting = {
    primaryLens: '35mm (Natural)',
    dominantMovement: 'Smooth Tracking (Dolly)',
    colorGrade: 'Natural cinematic grade',
  }

  const deliverySpec: DeliverySpec = {
    durationMs: totalDuration * 1000,
    aspectRatio: '16:9',
    fps: 24,
    resolution: '4K',
  }

  return {
    promptName: scenario.metadata.title,
    baseStyle,
    spatialContext,
    cameraSetting,
    deliverySpec,
  }
}

/**
 * 감독 강조 포인트 생성
 */
function generateDirectorEmphasis(scenario: Scenario) {
  const emphasis = []

  if (scenario.keywords) {
    scenario.keywords.forEach((keyword) => {
      emphasis.push({
        term: keyword,
        weight: 1.5,
      })
    })
  }

  if (scenario.metadata.genre) {
    emphasis.push({
      term: scenario.metadata.genre,
      weight: 2.0,
    })
  }

  return emphasis
}

/**
 * 컴팩트 출력 생성
 */
function generateCompactOutput(
  scenario: Scenario,
  timeline: TimelineItem[],
  totalDuration: number
) {
  const compactTimeline = timeline.map((item, index) => ({
    sequence: item.sequence,
    timestamp: `00:${String(index * 10).padStart(2, '0')}-00:${String(
      (index + 1) * 10
    ).padStart(2, '0')}`,
    action: item.visualDirecting,
    audio: item.audioLayers.voice || item.audioLayers.diegetic || 'Ambient sound',
  }))

  return {
    metadata: {
      prompt_name: scenario.metadata.title,
      base_style: 'Cinematic, Professional video production',
      aspect_ratio: '16:9',
      room_description: inferLocationFromScenes(scenario.scenes),
      camera_setup: '35mm lens, smooth tracking movements, natural lighting',
    },
    key_elements: scenario.keywords || [],
    assembled_elements: [],
    negative_prompts: ['low quality', 'blurry', 'distorted'],
    timeline: compactTimeline,
    text: scenario.storyOutline || 'Generated from scenario scenes',
    keywords: scenario.keywords || [],
  }
}

/**
 * 씬들로부터 분위기 추론
 */
function inferMoodFromScenes(scenes: Scene[]): string {
  const actionCount = scenes.filter((s) => s.type === 'action').length
  const dialogueCount = scenes.filter((s) => s.type === 'dialogue').length

  if (actionCount > dialogueCount) {
    return 'Tense'
  } else if (dialogueCount > 0) {
    return 'Dramatic'
  } else {
    return 'Contemplative'
  }
}

/**
 * 씬들로부터 주요 장소 추론
 */
function inferLocationFromScenes(scenes: Scene[]): string {
  const locations = scenes
    .map((scene) => scene.location)
    .filter(Boolean)
    .filter((loc, index, arr) => arr.indexOf(loc) === index)

  if (locations.length === 0) {
    return 'Generic interior space with natural lighting'
  }

  if (locations.length === 1) {
    return locations[0] as string
  }

  return `Multiple locations: ${locations.join(', ')}`
}
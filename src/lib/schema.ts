import { z } from 'zod';

// ScenePrompt 스키마
export const ScenePromptSchema = z.object({
  metadata: z.object({
    prompt_name: z.string(),
    base_style: z.string(),
    aspect_ratio: z.string().default("21:9"),
    room_description: z.string(),
    camera_setup: z.string(),
  }),
  key_elements: z.array(z.string()),
  assembled_elements: z.array(z.string()),
  negative_prompts: z.array(z.string()).optional(),
  timeline: z.array(z.object({
    sequence: z.number(),
    timestamp: z.string(), // "00:00-00:02"
    action: z.string(),
    audio: z.string(),
  })),
  text: z.union([z.literal("none"), z.string()]),
  keywords: z.array(z.string()),
});

// ScenePack 스키마
export const ScenePackSchema = z.object({
  scenes: z.array(ScenePromptSchema),
});

// KidChoice 스키마
export const KidChoiceSchema = z.object({
  theme: z.enum([
    "집", "부엌", "거실", "복도", "욕실(문 닫힘)",
    "바다(맑은 낮)", "숲(낮)", "도시 밤", "학교 운동장",
    "비 오는 골목", "눈 오는 밤", "우주선 내부(카툰풍)",
    "노을 해변", "사막 일몰", "설산 고원 밤",
    "비 오는 도시 카페", "도서관 오후", "지하철 승강장",
    "해질녘 옥상", "봄 벚꽃길"
  ]),
  characters: z.array(z.enum([
    "엄마", "아빠", "친구", "강아지", "고양이", "로봇"
  ])),
  action: z.array(z.enum([
    "걷기", "달리기", "요리", "춤", "숨바꼭질", "문열기/닫기"
  ])),
  mood: z.enum(["밝음", "아늑함", "모험", "신비", "차분"]),
  camera: z.enum([
    "와이드", "따라가기", "POV", "탑뷰", "돌리인", 
    "롱테이크", "핸드헬드", "드론 오비탈"
  ]),
  weather: z.enum(["맑음", "비", "눈", "안개"]).optional(),
  durationSec: z.union([z.literal(8), z.literal(10), z.literal(12)]).default(8),
});

// RecommendCard 스키마
export const RecommendCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  thumb: z.string().optional(),
  base_style: z.string(),
  room_description: z.string(),
  camera_setup: z.string(),
  keywords: z.array(z.string()),
  durationSec: z.union([z.literal(8), z.literal(10), z.literal(12)]),
});

// PEL 관련 스키마
export const CoreExtractionSchema = z.object({
  subject: z.array(z.string()),
  actions: z.array(z.string()),
  objects: z.array(z.string()),
  setting: z.array(z.string()),
});

export const DetailPackSchema = z.object({
  adjectives: z.array(z.string()),
  gear: z.array(z.string()),
  material: z.array(z.string()),
});

export const EnvironmentSchema = z.object({
  timeOfDay: z.string().optional(),
  weather: z.string().optional(),
  terrain: z.string().optional(),
});

export const MoodLightingSchema = z.object({
  mood: z.array(z.string()).optional(),
  lights: z.array(z.string()).optional(),
});

export const StyleCompSchema = z.object({
  style: z.array(z.string()).optional(),
  camera: z.array(z.string()).optional(),
  lens: z.array(z.string()).optional(),
  angle: z.array(z.string()).optional(),
});

export const TechSpecSchema = z.object({
  quality: z.enum(["high", "ultra"]).optional(),
  resolution: z.enum(["4K", "8K"]).optional(),
  aspect: z.enum(["21:9", "16:9"]).optional(),
});

export const EnhancementBundleSchema = z.object({
  core: CoreExtractionSchema,
  detail: DetailPackSchema,
  env: EnvironmentSchema,
  mood: MoodLightingSchema,
  style: StyleCompSchema,
  tech: TechSpecSchema,
});

// 타입 정의
export type ScenePrompt = z.infer<typeof ScenePromptSchema>;
export type ScenePack = z.infer<typeof ScenePackSchema>;
export type KidChoice = z.infer<typeof KidChoiceSchema>;
export type RecommendCard = z.infer<typeof RecommendCardSchema>;
export type CoreExtraction = z.infer<typeof CoreExtractionSchema>;
export type DetailPack = z.infer<typeof DetailPackSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
export type MoodLighting = z.infer<typeof MoodLightingSchema>;
export type StyleComp = z.infer<typeof StyleCompSchema>;
export type TechSpec = z.infer<typeof TechSpecSchema>;
export type EnhancementBundle = z.infer<typeof EnhancementBundleSchema>;

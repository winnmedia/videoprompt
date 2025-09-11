export interface StoryInput {
  title: string;
  oneLineStory: string;
  toneAndManner: string[];
  genre: string;
  target: string;
  duration: string;
  format: string;
  tempo: string;
  developmentMethod: string;
  developmentIntensity: string;
}

export interface StoryStep {
  id: string;
  title: string;
  summary: string;
  content: string;
  goal: string;
  lengthHint: string;
  isEditing: boolean;
}

export interface InsertShot {
  id: string;
  purpose: string;
  description: string;
  framing: string;
}

export interface Shot {
  id: string;
  stepId: string;
  title: string;
  description: string;
  shotType: string;
  camera: string;
  composition: string;
  length: number;
  dialogue: string;
  subtitle: string;
  transition: string;
  contiImage?: string;
  insertShots: InsertShot[];
}

export interface StoryboardShot {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  prompt?: string;
  shotType?: string;
  camera?: string;
  duration?: number;
  index: number;
}

export interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  category: 'advertisement' | 'vlog' | 'tutorial' | 'custom';
  thumbnailUrl?: string;
  isPublic: boolean;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  template: StoryInput;
}
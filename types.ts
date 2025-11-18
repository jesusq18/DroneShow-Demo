export enum EventType {
  Boda = "Boda",
  Festival = "Festival",
  Corporativo = "Evento corporativo",
  Concierto = "Concierto",
  Politica = "Campaña política",
  Otro = "Otro",
}

export type VideoStyle = 'magical' | 'energetic' | 'professional' | 'romantic' | 'dramatic' | 'playful';
export type AnimationSpeed = 'slow' | 'medium' | 'fast' | 'dynamic';
export type MusicStyle = 'Cinematic' | 'Rock' | 'Electronic' | 'Classical' | 'Pop' | 'Jazz' | 'Ambient';

export interface VideoConfig {
  style: VideoStyle;
  speed: AnimationSpeed;
  effectsIntensity: 'subtle' | 'moderate' | 'intense';
  includeParticles: boolean;
  includeTrails: boolean;
  cameraMovement: 'static' | 'gentle' | 'dynamic';
  durationSeconds?: 4 | 6 | 8;
  resolution?: '720p' | '1080p';
  aspectRatio?: '16:9' | '9:16';
}

export interface FormData {
  clientName: string;
  eventType: EventType;
  location: string;
  countryCity: string;
  droneCount: string;
  elements: string;
  notes: string;
  musicStyle: MusicStyle;
  hasTransition?: boolean;
  transitionElements?: string;
  transitionDescription?: string;
}

export interface ImageVersion {
  id: string;
  url: string;
  base64: string;
  mimeType: string;
  editPrompt?: string;
  createdAt: string;
  isOriginal: boolean;
}

export interface ClientRecord {
  id: string;
  createdAt: string;
  formData: FormData;
  generatedImageUrl: string;
  generatedVideoBase64?: string;
  generatedVideoMimeType?: string;
}

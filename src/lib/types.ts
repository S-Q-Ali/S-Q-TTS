export interface VoiceMetadata {
  name: string;
  shortName: string;
  gender: 'Female' | 'Male' | string;
  locale: string;
  friendlyName: string;
  suggestedCodec?: string;
  status?: string;
}

export interface TTSRequest {
  text: string;
  voice: string;
  rate?: string;   // e.g. "+0%", "+20%", "-10%"
  pitch?: string;  // e.g. "+0Hz", "+50Hz", "-50Hz"
  volume?: string; // e.g. "+0%", "-20%"
}

export interface HistoryItem {
  id: string;
  text: string;
  voice: string;
  voiceLabel: string;
  timestamp: number;
  audioUrl: string;
  duration?: number;
}

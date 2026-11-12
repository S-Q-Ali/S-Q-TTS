export interface Preset {
  id: string;
  label: string;
  language: string;
  voice: string;
  text: string;
  rate?: number;
  pitch?: number;
}

export const SAMPLE_PRESETS: Preset[] = [
  {
    id: "brian-motivational",
    label: "🔥 Deep Motivational (Brian)",
    language: "English",
    voice: "en-US-BrianNeural",
    rate: -8,
    pitch: -3,
    text: "Your life isn't yours if you always care about what others think about you. Don't lose your mind over people who wouldn't think twice about losing you. You only have one life to live. So make sure it's yours.",
  },
  {
    id: "en-us-1",
    label: "English Narrative (Jenny)",
    language: "English",
    voice: "en-US-JennyNeural",
    text: "Welcome to S-Q TTS Studio. Convert your written thoughts into crystal-clear, natural human speech.",
  },
  {
    id: "en-us-2",
    label: "English Conversational (US)",
    language: "English",
    voice: "en-US-GuyNeural",
    text: "Hey there! With this studio, you can effortlessly create voiceovers, audiobooks, and video narrations completely free.",
  },
  {
    id: "en-gb-1",
    label: "English British (UK)",
    language: "English",
    voice: "en-GB-SoniaNeural",
    text: "Good day. Discover the remarkable depth and authenticity of advanced neural speech synthesis.",
  },
  {
    id: "en-au-1",
    label: "English Australian (AU)",
    language: "English",
    voice: "en-AU-NatashaNeural",
    text: "G'day! Experience top-tier audio quality with fluid pronunciation and natural rhythm.",
  },
  {
    id: "urdu-1",
    label: "اردو خوش آمدید (Urdu Welcome)",
    language: "Urdu",
    voice: "ur-PK-UzmaNeural",
    text: "خوش آمدید! یہ مائیکروسافٹ ایج کا انتہائی حقیقت پسندانہ ٹیکسٹ ٹو اسپیچ انجن ہے۔",
  },
  {
    id: "urdu-2",
    label: "اردو خبریں (Urdu News)",
    language: "Urdu",
    voice: "ur-PK-AsadNeural",
    text: "آج کے اہم ترین واقعات اور معلوماتی خبروں کے ساتھ ہم آپ کی خدمت میں حاضر ہیں۔",
  },
  {
    id: "ar-sa-1",
    label: "عربي فصيح (Arabic)",
    language: "Arabic",
    voice: "ar-SA-ZariyahNeural",
    text: "مرحباً بكم في تطبيق تحويل النص إلى كلام عالي الجودة والوضوح.",
  },
  {
    id: "hi-in-1",
    label: "हिन्दी समाचार (Hindi)",
    language: "Hindi",
    voice: "hi-IN-SwaraNeural",
    text: "नमस्ते! इस आधुनिक टेक्स्ट-टू-स्पीچ ऐप में आपका स्वागत है।",
  },
];

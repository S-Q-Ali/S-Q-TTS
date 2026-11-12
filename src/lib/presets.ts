export interface Preset {
  id: string;
  label: string;
  language: string;
  voice: string;
  text: string;
}

export const SAMPLE_PRESETS: Preset[] = [
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
    id: "en-us-1",
    label: "English Narrative (US)",
    language: "English",
    voice: "en-US-JennyNeural",
    text: "Welcome to S-Q TTS. Transforming written thoughts into crystal clear, natural human speech.",
  },
  {
    id: "en-us-2",
    label: "English Conversational (US)",
    language: "English",
    voice: "en-US-GuyNeural",
    text: "Hey there! With this tool, you can create voiceovers, audiobooks, and tutorials completely free.",
  },
  {
    id: "en-gb-1",
    label: "English British (UK)",
    language: "English",
    voice: "en-GB-SoniaNeural",
    text: "Good day. Discover the remarkable clarity of advanced neural speech synthesis.",
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
    text: "नमस्ते! इस आधुनिक टेक्स्ट-टू-स्पीच ऐप में आपका स्वागत है।",
  },
];

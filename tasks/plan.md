# Implementation Plan: S-Q-TTS (Production-Grade Edge TTS Web App)

## Overview
A production-ready, full-stack Text-to-Speech (TTS) web application leveraging Microsoft Edge's Neural TTS via `msedge-tts` (100% free, high-fidelity AI voices, zero API keys required). Built with Next.js (App Router), React, Tailwind CSS, Lucide icons, and TypeScript.

## Architecture & Technology Stack
- **Framework:** Next.js 15+ (App Router) with TypeScript & React 19
- **Styling:** Tailwind CSS + PostCSS + Lucide React icons
- **TTS Engine:** `msedge-tts` (Node.js runtime server-side API handler)
- **State Management:** React state & local storage for history persistence
- **Audio Output:** Streamed direct MP3 buffer via Next.js Route Handler (`/api/tts`), with downloadable blob and interactive player.

## User Persona & Core Features
- **Multilingual Support:** Special first-class emphasis on Urdu (`ur-PK` Uzma & Asad), Hindi, Arabic, English (`en-US`, `en-GB`), and 300+ global voices.
- **Controls:** Pitch, Speed / Rate (-50% to +100%), Volume.
- **Player:** Custom audio controller with playback speed, seekbar, loop, and instant MP3 download.
- **Presets & History:** Quick demo sentences (Urdu & English) and local generation history with replay.
- **Quality Floor:** Responsive on mobile and desktop, WCAG accessible, dark/light theme harmony.

## Component Structure
```
src/
├── app/
│   ├── api/
│   │   ├── tts/route.ts       # Synthesizes text to MP3 stream
│   │   └── voices/route.ts    # Returns categorized voice metadata
│   ├── layout.tsx
│   ├── page.tsx               # Main TTS studio interface
│   └── globals.css
├── components/
│   ├── Header.tsx             # Studio branding & badges
│   ├── TextInput.tsx          # Text input, char count, preset chips
│   ├── VoiceSelector.tsx      # Language & voice picker with search
│   ├── VoiceControls.tsx      # Speed, Pitch & Volume sliders
│   ├── AudioPlayer.tsx        # Modern audio player with download action
│   └── HistoryList.tsx        # Generation history with instant playback
└── lib/
    ├── types.ts               # Shared TypeScript types
    └── presets.ts             # Sample texts across languages
```

## Risks & Mitigations
- **WebSocket connection stability:** Edge TTS communicates over WebSockets; ensure error handling and fallback defaults if synthesis temporarily drops.
- **Serverless/Runtime execution:** Next.js Route Handler for `/api/tts` must run on Node.js runtime (`export const runtime = 'nodejs'`).

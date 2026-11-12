# Implementation Tasks: S-Q-TTS

## Task 1: Project Initialization & Dependency Setup
**Description:** Initialize Next.js project with TypeScript, Tailwind CSS, install `msedge-tts`, `lucide-react`, and configure environment.
**Acceptance Criteria:**
- [x] Next.js app structure initialized with `src/` directory.
- [x] `msedge-tts`, `lucide-react`, and tailwind configured.
- [x] Application compiles cleanly (`npm run build` or `npm run dev`).
**Verification:**
- [x] `npm run build` succeeds.
**Dependencies:** None
**Estimated Scope:** S (configuration files, package.json)

---

## Task 2: Backend API Routes (`/api/voices` and `/api/tts`)
**Description:** Build server-side route handlers to query available voices and synthesize audio into MP3 binary streams using `msedge-tts`.
**Acceptance Criteria:**
- [x] `GET /api/voices` returns sorted list of available neural voices with language tags.
- [x] `POST /api/tts` accepts `{ text, voice, rate, pitch, volume }` and streams back `audio/mpeg`.
- [x] Validates inputs and handles errors gracefully.
**Verification:**
- [x] Test `/api/voices` endpoint returns valid JSON with voices.
- [x] Test `/api/tts` endpoint generates a playable MP3 audio stream.
**Dependencies:** Task 1
**Estimated Scope:** S (2 route files + types)

---

## Task 3: Core UI Components (TextInput, VoiceSelector, VoiceControls)
**Description:** Implement modular React components for text entry, language/voice search and filtering, and prosody controls (speed, pitch, volume).
**Acceptance Criteria:**
- [x] `TextInput` supports multi-line text, character counter, sample presets.
- [x] `VoiceSelector` allows searching by language name or voice code with gender indicators.
- [x] `VoiceControls` provides sliders for Speed/Rate and Pitch.
**Verification:**
- [x] Components render properly with full accessibility and responsive layout.
**Dependencies:** Task 2
**Estimated Scope:** M (3-4 UI components)

---

## Task 4: Audio Player & History Management
**Description:** Build custom audio player with waveform/progress bar, play/pause, time tracker, and direct MP3 download. Implement local storage generation history.
**Acceptance Criteria:**
- [x] Audio plays smoothly upon generation with direct download button.
- [x] Audio history preserves previous generation text, voice name, and audio blob.
- [x] Responsive across mobile and desktop viewports.
**Verification:**
- [x] Generate audio, play back, download MP3, test history reload.
**Dependencies:** Task 3
**Estimated Scope:** M (Audio player & history components)

---

## Task 5: Testing, Polish, and Production Commit
**Description:** End-to-end integration testing, polish typography and theme aesthetics, verify clean build, and commit to git with conventional commit messages.
**Acceptance Criteria:**
- [x] End-to-end workflow functions flawlessly (generate Urdu, English, etc.).
- [x] Zero TypeScript or runtime warnings.
- [x] `git status` clean and committed.
**Verification:**
- [x] `npm run build` passes with zero errors.
- [x] Git commit and status verified.
**Dependencies:** Task 4
**Estimated Scope:** S (README update, build test, git commit)

---

## Task 6: Professional Voice Preset System
**Description:** Build a dedicated Voice Preset management architecture separating vocal acoustics/tuning from text input, featuring built-in templates (Stoic Reel, Audiobook, YouTube Explainer, Urdu Dastan), custom preset creation, localStorage persistence, and JSON export/import.
**Acceptance Criteria:**
- [x] `VoicePreset` schema created with curated built-in sound profiles.
- [x] `VoicePresetBar` component built with 1-click apply that tunes Voice, Speed, Pitch, Volume without overriding text.
- [x] User can save custom presets with custom names, stored in localStorage.
- [x] User can delete custom presets and export/import presets as JSON.
- [x] Separated text ideas from vocal acoustic profiles.
**Verification:**
- [x] Apply preset and verify Voice, Speed, Pitch update while text remains untouched.
- [x] Save custom preset, refresh page, verify persistence.
- [x] `npm run build` succeeds with 0 errors.
**Dependencies:** Task 5
**Estimated Scope:** M (1 new lib module + 1 UI component + page integration)

---

## Task 7: Smart Script Tag Manager (Beta) & Female Voice Presets
**Description:** Implement 3-tier dynamic NLP stage-direction & pause parser (`[Soft and reflective]`, `[Short pause]`, etc.) to auto-manage bracketed script cues into natural audio pauses, and expand Voice Presets to include top-tier Female voices (Emma, Ava, Sonia, Uzma, Jenny) with gender filtering.
**Acceptance Criteria:**
- [x] `src/lib/script-parser.ts` handles pause detection, emotion muting, and general bracket fallback dynamically.
- [x] `TextInput.tsx` displays Beta Smart Script Tag Manager banner with detected tag badges and preview clean text toggle.
- [x] Added 5 curated female presets with gender toggle filter in `VoicePresetBar.tsx`.
- [x] Server endpoint `/api/tts` processes stage directions automatically.
**Verification:**
- [x] Parse user's script with 9 stage directions and verify no bracket words are spoken.
- [x] Test Female voices (`Emma`, `Ava`, `Sonia`, `Uzma`) synthesis.
- [x] `npm run build` succeeds with 0 errors.
**Dependencies:** Task 6
**Estimated Scope:** M (script parser + female presets + UI integration)

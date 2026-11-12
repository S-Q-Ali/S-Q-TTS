# 🎙️ S-Q TTS Studio

A modern, production-grade **Text-to-Speech (TTS) Web Application** powered by **Microsoft Edge Neural Speech Synthesis**.

100% Free • No Azure Subscription • No API Keys • Over 300+ Natural Neural Voices

---

## ✨ Features

- **High-Quality Neural Voices:** Access Microsoft's state-of-the-art neural speech voices across 70+ languages.
- **First-Class Urdu Support:** Native support for high-fidelity Urdu voices (`ur-PK-UzmaNeural`, `ur-PK-AsadNeural`, `ur-IN-GulNeural`, `ur-IN-SalmanNeural`).
- **Fine-Grained Prosody Controls:**
  - **Speed / Rate:** 0.5x to 2.0x playback speed adjustment.
  - **Pitch:** -50Hz to +50Hz pitch customization.
  - **Volume:** -50% to +50% volume boost or attenuation.
- **Custom Audio Player:**
  - Real-time seek bar and audio duration tracking.
  - Playback speed multiplier (1x, 1.25x, 1.5x, 2x).
  - One-click **Direct MP3 Download**.
- **Local Generation History:** Stores past voice generations for instant replay without re-synthesizing.
- **RTL & Multilingual Ready:** Auto-detects Right-to-Left (Urdu, Arabic) script orientation.
- **Modern UI:** Built with Next.js 15, React 19, and Tailwind CSS with glassmorphism and accessible controls.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher (v20+ recommended)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### Installation

1. Clone repository:
   ```bash
   git clone https://github.com/S-Q-Ali/S-Q-TTS.git
   cd S-Q-TTS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 🏗️ Architecture

```
Client (Next.js / React 19 + Tailwind CSS)
            │
            │ REST POST /api/tts { text, voice, rate, pitch, volume }
            ▼
Server (Next.js Node.js Route Handler)
            │
            │ msedge-tts (WebSocket)
            ▼
Microsoft Edge Neural TTS Service
            │
            │ Binary MP3 Stream
            ▼
Audio Player & Direct MP3 Download
```

---

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Icons:** [Lucide React](https://lucide.dev/)
- **TTS Engine:** [`msedge-tts`](https://www.npmjs.com/package/msedge-tts)

---

## 📄 License
MIT License. Free for personal and commercial use.

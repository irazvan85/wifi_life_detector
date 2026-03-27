<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# VitalScan — WiFi Life Detector

> **Contactless vital signs monitoring using simulated WiFi Channel State Information (CSI)**

A Progressive Web App (PWA) built with React + TypeScript that demonstrates WiFi-based human presence detection and vital signs extraction. Breathing and heartbeats cause micro-variations in WiFi signal reflections — this app simulates that physics, applies digital signal processing, and renders live waveforms and a radar display in the browser.

View the live app: https://ai.studio/apps/848a2f46-8c77-4552-b0c7-2605771a40ab

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Signal Processing](#signal-processing)
- [Data Flow](#data-flow)
- [Component Structure](#component-structure)
- [PWA Configuration](#pwa-configuration)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Configuration](#configuration)
- [Future Enhancements](#future-enhancements)

---

## Overview

**VitalScan** demonstrates the core principle of WiFi-CSI vital signs monitoring:

- A WiFi transmitter–receiver pair captures **Channel State Information** — a per-subcarrier amplitude and phase measurement at every packet.
- When a human stands in the Fresnel zone of the link, breathing (~0.1–0.5 Hz) and heartbeats (~0.8–2.0 Hz) induce periodic amplitude fluctuations.
- Bandpass filtering isolates each physiological band; frequency analysis or peak detection extracts the rates.

The current version uses a **software simulation** of CSI data (no physical hardware required). Up to two subjects are simulated with randomised vital signs, realistic distance attenuation, position drift, and occasional movement bursts.

**What is monitored:**

| Vital sign | Simulated range | Normal range |
|---|---|---|
| Heart Rate | 55–105 bpm | 60–100 bpm |
| Respiratory Rate | 10–22 br/min | 12–20 br/min |
| Movement Index | 0–100 | — |
| Confidence | 60–95 % | — |

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 |
| Language | TypeScript ~5.8 |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 4 |
| Animations | Motion/React 12 (Framer Motion v3 API) |
| Icons | Lucide React |
| AI (optional) | Google Gemini (`@google/genai`) |
| Server (optional) | Express 4 |
| PWA | Custom service worker + Web App Manifest |

---

## Architecture

```
wifi_life_detector/
├── src/
│   ├── main.tsx                        # React entry point; registers PWA service worker
│   ├── App.tsx                         # Root UI component — layout, header, state wiring
│   ├── types.ts                        # Shared TypeScript interfaces
│   ├── index.css                       # Global styles (Tailwind + custom utilities)
│   ├── simulation/
│   │   └── csiEngine.ts               # CSI simulation engine (class CSIEngine)
│   ├── processing/
│   │   └── vitalSignsProcessor.ts     # IIR bandpass filter & waveform buffers (class VitalSignsProcessor)
│   ├── hooks/
│   │   └── useVitalSigns.ts           # React hook — orchestrates engine, processor, intervals
│   └── components/
│       ├── RadarDisplay.tsx           # Animated polar radar with subject blips
│       ├── VitalCard.tsx              # Metric card (HR, RR, Movement, Confidence)
│       └── WaveformChart.tsx          # Canvas-based real-time signal chart
├── public/
│   ├── manifest.json                  # PWA Web App Manifest
│   ├── sw.js                          # Service worker (network-first + cache-first)
│   └── icons/
│       ├── icon-192.svg
│       └── icon-512.svg
├── index.html                         # HTML shell (PWA meta tags, fonts)
├── vite.config.ts                     # Vite config (React plugin, Tailwind, env injection)
├── tsconfig.json                      # TypeScript config (ES2022, bundler resolution)
└── package.json
```

### Module responsibilities

| Module | Responsibility |
|---|---|
| `CSIEngine` | Generates per-subcarrier CSI amplitude at 20 Hz. Maintains subject state (HR, RR, position, movement). Applies distance attenuation and Gaussian noise. |
| `VitalSignsProcessor` | Accepts the mean CSI amplitude sample-by-sample. Runs two cascaded first-order IIR bandpass filters (breathing band and heartbeat band). Maintains 200-sample FIFO waveform buffers (~10 s). |
| `useVitalSigns` | Custom hook that creates and wires the engine and processor. Drives a 50 ms sample interval (20 Hz) and a 250 ms UI-update interval (4 Hz). Exposes `status`, `subjects`, `waveform`, `startMonitoring`, `stopMonitoring`. |
| `App.tsx` | Consumes `useVitalSigns`. Renders the header, info banner, radar panel, vital cards, presence indicator, and three waveform charts. |
| `RadarDisplay` | Draws concentric distance rings, an animated rotating sweep, and animated blips for each detected subject at their polar coordinates. |
| `VitalCard` | Reusable card with colour-coded status (green/yellow/red) for a single vital-sign metric. |
| `WaveformChart` | Canvas element that plots the last N samples of a signal buffer. Re-renders on every waveform state update. |

---

## Signal Processing

### CSI Simulation (`src/simulation/csiEngine.ts`)

For each 50 ms tick, `generateSample()` synthesises 30 subcarrier amplitudes:

```
amplitude[sc] = 1.0  (baseline)

for each subject s:
  breathing  = 0.15 × sin(2π × f_breath × t  +  sc × 0.1)
               where f_breath = respiratoryRate / 60  [Hz]

  heartbeat  = 0.04 × sin(2π × f_heart  × t  +  sc × 0.05)
               where f_heart  = heartRate / 60  [Hz]

  movement   = movementAmplitude × sin(2π × 0.5 × t + movementPhase)
               (0.5 Hz, non-zero only during occasional burst)

  attenuation = 1 / (1 + distance × 0.3)   (Fresnel-inspired path loss)

  amplitude[sc] += (breathing + heartbeat + movement) × attenuation

amplitude[sc] += Uniform(−0.15, +0.15)     (Gaussian-like noise)
```

`meanAmplitude` = average of all 30 subcarrier amplitudes — this scalar is what the processor receives.

**Subject state evolution (every 250 ms `updateSubjects()` call):**

- HR variation drifts ±0.5 bpm per frame, clamped to ±5 bpm from target.
- RR variation drifts ±0.2 br/min per frame, clamped to ±3 br/min from target.
- Movement amplitude decays by a factor of 0.995 per frame (~3 s half-life).
- A new movement burst (amplitude 0.2–0.5) triggers at most once per 8 s with probability 2 % per update.
- Position drifts: angle ±0.3°, distance ±0.02 m, both clamped to valid ranges.

**Confidence score:**

```
confidence = clamp(95 − distance × 5 + noise(±2), 60, 100)
```

Decreases with distance, minimum 60 %.

---

### Signal Processing (`src/processing/vitalSignsProcessor.ts`)

Raw `meanAmplitude` samples are fed into two independent cascaded first-order IIR bandpass filters.

#### IIR Bandpass Filter Design

Each bandpass filter is formed by cascading:
1. **First-order low-pass** (removes energy above `highCutoff`)
2. **First-order high-pass** (removes energy below `lowCutoff`) applied to the low-pass output

```
Low-pass:
  α_low  = f_high / (f_high + 1/(2π))
  y_LP[n] = y_LP[n-1]  +  α_low × (x[n] − y_LP[n-1])

High-pass (applied to y_LP):
  α_high = 1 / (1 + 2π × f_low)
  y_HP[n] = α_high × (y_HP[n-1] + y_LP[n] − y_LP[n-1])
```

All cutoff frequencies are normalised to the sample rate (20 Hz).

#### Filter Bands

| Band | Frequency range | Normalised cutoffs | Physiological target |
|---|---|---|---|
| Breathing | 0.1–0.5 Hz | 0.005–0.025 | 6–30 breaths/min |
| Heartbeat | 0.8–2.0 Hz | 0.04–0.10 | 48–120 bpm |

Computed filter coefficients:

```
Breathing band:
  α_low  = 0.025 / (0.025 + 1/(2π))  ≈ 0.0158
  α_high = 1 / (1 + 2π × 0.005)      ≈ 0.9695

Heartbeat band:
  α_low  = 0.10  / (0.10  + 1/(2π))  ≈ 0.0632
  α_high = 1 / (1 + 2π × 0.04)       ≈ 0.8866
```

#### Waveform Buffers

Each filter maintains a separate 200-sample FIFO (`Array.shift()` on overflow):

- `csiSignal[]` — raw mean amplitude (200 samples, ~10 s)
- `breathingSignal[]` — breathing bandpass output
- `heartbeatSignal[]` — heartbeat bandpass output
- `timestamps[]` — Unix ms timestamps

> **Note:** In a production system, a higher-order FIR or Butterworth IIR filter and FFT-based frequency estimation would replace these simple first-order filters. The architecture here cleanly separates simulation from processing, making the processor module easy to swap out.

---

## Data Flow

```
CSIEngine.generateSample()          (every 50 ms, 20 Hz)
        │
        │  CSISample { amplitudes[30], meanAmplitude, timestamp }
        ▼
VitalSignsProcessor.addSample()
        │
        ├─ Breathing IIR bandpass (0.1–0.5 Hz) → breathingBuffer[200]
        └─ Heartbeat IIR bandpass (0.8–2.0 Hz) → heartbeatBuffer[200]

CSIEngine.updateSubjects()          (every 250 ms, 4 Hz)
        │
        └─ Drift HR, RR, movement, position

useVitalSigns hook                  (250 ms UI update)
        │
        ├─ setSubjects( engine.getDetectedSubjects() )
        └─ setWaveform( processor.getWaveformData()  )
                │
                ▼
            App.tsx re-renders
                ├── RadarDisplay  ← subjects (polar coords)
                ├── VitalCard ×4  ← HR, RR, Movement, Confidence
                ├── Presence bar  ← movementIndex
                └── WaveformChart ×3 ← csiSignal, breathingSignal, heartbeatSignal
```

**Hook state machine:**

```
idle ──startMonitoring()──► initializing (1.5 s calibration)
                                    │
                                    ▼
                              monitoring ──stopMonitoring()──► idle
```

---

## Component Structure

```
App.tsx
├── Header
│   ├── App title
│   ├── Status badge  (Standby / Calibrating… / N Subjects Detected)
│   └── Start / Stop button
├── Info banner  (shown in idle state only)
└── Main grid  (responsive: 1-col mobile, 5+7-col desktop)
    ├── Left column
    │   ├── RadarDisplay
    │   │   ├── Distance rings (1m – 8m)
    │   │   ├── Rotating sweep animation
    │   │   └── Subject blips  (animated entry/exit)
    │   └── Detected subjects list
    │       └── Subject card  (label, distance, angle)
    └── Right column
        ├── VitalCard  – Heart Rate
        ├── VitalCard  – Respiratory Rate
        ├── VitalCard  – Movement Index
        ├── VitalCard  – Confidence
        ├── Life Presence bar  (progress indicator)
        └── Waveform charts
            ├── WaveformChart  – Raw CSI Signal (green)
            ├── WaveformChart  – Breathing  (blue)
            └── WaveformChart  – Heartbeat  (red)
```

---

## PWA Configuration

The app uses a **manual PWA setup** (no vite-plugin-pwa):

| File | Purpose |
|---|---|
| `public/manifest.json` | App name (`VitalScan`), theme colour (`#0f172a`), display mode (`standalone`), icon paths, category (`medical`) |
| `public/sw.js` | Service worker — network-first for navigation requests, cache-first for static assets. Cache name `vitalscan-v1`. |
| `public/icons/icon-192.svg` | PWA icon at 192 × 192 |
| `public/icons/icon-512.svg` | PWA icon at 512 × 512 |
| `src/main.tsx` | Registers `/sw.js` via `navigator.serviceWorker.register()` on `load` |
| `index.html` | `<meta name="theme-color">`, `<meta name="apple-mobile-web-app-*">`, `<link rel="manifest">` |

The app is fully installable on Android (Chrome) and iOS (Safari Add to Home Screen) and works offline for cached assets.

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Set environment variables
cp .env.example .env.local
# Edit .env.local — set GEMINI_API_KEY if using AI features

# 3. Start the development server (port 3000)
npm run dev

# Access from any device on the same LAN:
# http://<your-ip>:3000
```

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite --port=3000 --host=0.0.0.0` | Start dev server with HMR |
| `build` | `vite build` | Production build → `dist/` |
| `preview` | `vite preview` | Serve production build locally |
| `clean` | `rm -rf dist` | Remove build artefacts |
| `lint` | `tsc --noEmit` | TypeScript type-check (no emit) |

---

## Configuration

### Environment variables (`.env.local`)

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key — used if AI inference features are enabled |
| `APP_URL` | Self-referential base URL — injected by AI Studio or set manually |

Variables are injected into the Vite bundle via `define` in `vite.config.ts`:

```ts
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
}
```

### TypeScript (`tsconfig.json`)

- Target: `ES2022`
- Module: `ESNext` with `bundler` resolution
- JSX: `react-jsx`
- Path alias: `@` → repository root

### CSS theming (`src/index.css`)

- Fonts: Inter (sans) and JetBrains Mono (mono) from Google Fonts
- Custom Tailwind theme tokens: `--font-sans`, `--font-mono`
- `overscroll-behavior-y: contain` on `#root` prevents pull-to-refresh interference
- `env(safe-area-inset-*)` padding for notched devices

---

## Future Enhancements

- **Real hardware integration** — Linux CSI Tools, Nexmon, or ESP32 with CSI firmware to feed live data into `VitalSignsProcessor`
- **FFT-based frequency estimation** — Replace IIR peak-detection with Welch power-spectral-density for more accurate rate extraction
- **Higher-order filters** — Butterworth or Chebyshev IIR / linear-phase FIR filters to improve stopband rejection
- **Multi-room deployment** — Express backend aggregating data from multiple sensor nodes
- **Historical logging** — IndexedDB persistence for trend analysis and session replay
- **AI anomaly detection** — Gemini API integration for irregularity alerts (arrhythmia, apnoea)
- **Test suite** — Vitest unit tests for `CSIEngine` and `VitalSignsProcessor`; Playwright e2e tests for the UI
- **Dark / light theme toggle**
- **Calibration wizard** — Guided baseline capture to improve SNR before monitoring begins

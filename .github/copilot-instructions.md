# VitalScan – WiFi Life Detector

PWA that simulates WiFi-CSI-based vital-signs monitoring. React 19 + TypeScript + Vite 6 + Tailwind CSS 4.

See [README.md](../README.md) for full architecture, signal-processing math, and data-flow diagrams.
See [readme_esp32-c3.md](../readme_esp32-c3.md) for real hardware (ESP32-C3) integration notes.

---

## Build & Dev

```bash
npm install
npm run dev        # Vite dev server on http://localhost:3000
npm run build      # Production build → dist/
npm run lint       # tsc --noEmit (type-check only, no separate eslint config)
npm run preview    # Serve dist/ locally
```

No test framework is configured; rely on `npm run lint` + manual browser testing.

---

## Architecture

| Layer | Path | Responsibility |
|-------|------|----------------|
| Types | `src/types.ts` | All shared interfaces – update here first |
| Simulation | `src/simulation/csiEngine.ts` | `CSIEngine` class – 20 Hz CSI sample generation |
| Processing | `src/processing/vitalSignsProcessor.ts` | `VitalSignsProcessor` – cascaded IIR bandpass filters |
| Estimator | `src/processing/vitalSignsEstimator.ts` | Derives bpm/rr from filtered waveform buffers |
| Hook | `src/hooks/useVitalSigns.ts` | Orchestrates engine + processor; exposes `status`, `subjects`, `waveform` |
| Hardware | `src/hardware/HardwareAdapter.ts` | Abstract base; `WebSerialAdapter` and `WebSocketAdapter` extend it |
| Components | `src/components/` | `RadarDisplay`, `VitalCard`, `WaveformChart`, `ConnectionPanel`, `WaveformChart` |
| Entry | `src/App.tsx` | Root layout + state wiring via `useVitalSigns` |

---

## Key Conventions

### Hardware adapters
- Extend `HardwareAdapter` (abstract class in `src/hardware/`).
- Call `emitSample` when a CSI frame arrives; fire `onSample` / `onError` / `onStateChange` listeners.
- Listener registration returns a cleanup function (unsubscribe pattern) – always do the same.

### Signal flow (do not break this pipeline)
```
CSIEngine.generateSample()
  → meanAmplitude scalar
  → VitalSignsProcessor.addSample()
  → breathingSignal / heartbeatSignal FIFO buffers (200 samples, ~10 s)
  → VitalSignsEstimator → bpm / rr
  → useVitalSigns → React state → components
```

### Timing
- **20 Hz** sampling interval (50 ms) – `csiEngine` + `processor`.
- **4 Hz** UI-update interval (250 ms) – `useVitalSigns` state flush.
- Do not change these without updating dependent filter coefficients (see README §Signal Processing).

### Styling
- Tailwind CSS 4 (plugin mode via `@tailwindcss/vite` – no `tailwind.config.js`).
- Dark-theme palette defined in `src/index.css`.
- Animations via `motion` (Framer Motion v3 API, package `motion`).

### Canvas rendering
- `WaveformChart` uses a `<canvas>` element; re-renders on every waveform state update (4 Hz).
- Do not add React state inside canvas components – pass data as props.

### TypeScript
- `tsconfig.json` targets ES2022, `moduleResolution: bundler`.
- No `any` – use the interfaces in `src/types.ts`; extend them rather than casting.

---

## PWA
- Service worker: `public/sw.js` (network-first for API, cache-first for assets).
- Manifest: `public/manifest.json`.
- Registered in `src/main.tsx` at startup.

---

## Pitfalls
- **Tailwind v4 has no config file** – utility classes are discovered automatically; do not create `tailwind.config.js`.
- **`motion` ≠ `framer-motion`** – import from `motion/react`, not `framer-motion`.
- **Web Serial / WebSocket adapters are browser-only** – guard with `typeof navigator !== 'undefined'` when adding SSR or Node-side code.
- **Filter coefficients are hard-coded** for 20 Hz – recalculate if sample rate changes (see README §IIR Bandpass Filter Design).

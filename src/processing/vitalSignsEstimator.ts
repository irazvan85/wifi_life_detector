import { VitalSigns, WaveformData } from '../types';

const SAMPLE_RATE = 20; // Hz — must match VitalSignsProcessor

/**
 * Estimates heart rate, respiratory rate, and presence from the
 * bandpass-filtered waveform buffers.
 *
 * For the simulation path the CSIEngine already provides these values,
 * but when running on **real hardware** we need to derive them from
 * the actual signal.
 *
 * The estimation uses simple zero-crossing counting which is
 * lightweight enough to run at 4 Hz in the browser.
 */
export function estimateVitalSigns(waveform: WaveformData): VitalSigns {
  const breathingRate = estimateRate(waveform.breathingSignal, 6, 30);
  const heartRate = estimateRate(waveform.heartbeatSignal, 48, 120);

  // Movement index from raw signal variance
  const movementIndex = estimateMovement(waveform.csiSignal);

  // Presence is declared when we see reasonable signal energy
  const energy = signalEnergy(waveform.csiSignal);
  const presenceDetected = energy > 0.001 && waveform.csiSignal.length > 40;

  // Confidence based on buffer fill and signal quality
  const bufferFill = Math.min(waveform.csiSignal.length / 200, 1);
  const confidence = presenceDetected
    ? Math.round(Math.min(100, bufferFill * 80 + (1 - movementIndex / 100) * 20))
    : 0;

  return {
    heartRate: Math.round(heartRate),
    respiratoryRate: Math.round(breathingRate),
    movementIndex: Math.round(movementIndex),
    presenceDetected,
    confidence,
  };
}

/**
 * Estimate rate (events/min) by counting positive zero-crossings in the
 * filtered signal and converting to bpm / breaths-per-minute.
 */
function estimateRate(signal: number[], minRate: number, maxRate: number): number {
  if (signal.length < SAMPLE_RATE * 2) return 0; // need ≥ 2 s of data

  // Use the most recent 10 seconds (or what's available)
  const window = signal.slice(-SAMPLE_RATE * 10);
  let crossings = 0;
  for (let i = 1; i < window.length; i++) {
    if (window[i - 1] <= 0 && window[i] > 0) crossings++;
  }

  const durationMin = window.length / SAMPLE_RATE / 60;
  const rate = crossings / durationMin;

  // Clamp to physiological range
  return Math.max(minRate, Math.min(maxRate, rate));
}

/**
 * Compute a movement index (0–100) from short-term variance of the
 * raw CSI signal.
 */
function estimateMovement(signal: number[]): number {
  if (signal.length < 20) return 0;
  const recent = signal.slice(-40);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length;
  // Map variance to 0-100 scale (tuned empirically for CSI amplitudes ~1.0)
  return Math.min(100, variance * 5000);
}

function signalEnergy(signal: number[]): number {
  if (signal.length === 0) return 0;
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  return signal.reduce((s, v) => s + (v - mean) ** 2, 0) / signal.length;
}

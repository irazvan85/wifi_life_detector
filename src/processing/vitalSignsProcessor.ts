import { WaveformData } from '../types';

const BUFFER_SIZE = 200; // ~10 seconds at 20Hz
const SAMPLE_RATE = 20; // Hz

/**
 * Vital Signs Signal Processor
 *
 * Processes raw CSI amplitude data to extract breathing and heartbeat
 * waveforms using bandpass filtering. In a real implementation, this
 * would use FFT-based frequency analysis on actual CSI data.
 *
 * Frequency bands:
 * - Breathing: 0.1-0.5 Hz (6-30 breaths/min)
 * - Heartbeat: 0.8-2.0 Hz (48-120 bpm)
 */
export class VitalSignsProcessor {
  private rawBuffer: number[] = [];
  private breathingBuffer: number[] = [];
  private heartbeatBuffer: number[] = [];
  private timestampBuffer: number[] = [];

  // Simple IIR filter states for breathing band
  private breathLowState = 0;
  private breathHighState = 0;
  private breathPrevInput = 0;

  // Simple IIR filter states for heartbeat band
  private heartLowState = 0;
  private heartHighState = 0;
  private heartPrevInput = 0;

  /** Process a new CSI mean amplitude sample */
  addSample(amplitude: number, timestamp: number): void {
    // Store raw signal
    this.rawBuffer.push(amplitude);
    this.timestampBuffer.push(timestamp);

    // Extract breathing component (bandpass 0.1-0.5 Hz)
    const breathingValue = this.bandpassFilter(
      amplitude,
      0.1 / SAMPLE_RATE,
      0.5 / SAMPLE_RATE,
      'breath',
    );
    this.breathingBuffer.push(breathingValue);

    // Extract heartbeat component (bandpass 0.8-2.0 Hz)
    const heartbeatValue = this.bandpassFilter(
      amplitude,
      0.8 / SAMPLE_RATE,
      2.0 / SAMPLE_RATE,
      'heart',
    );
    this.heartbeatBuffer.push(heartbeatValue);

    // Trim buffers to BUFFER_SIZE
    if (this.rawBuffer.length > BUFFER_SIZE) {
      this.rawBuffer.shift();
      this.breathingBuffer.shift();
      this.heartbeatBuffer.shift();
      this.timestampBuffer.shift();
    }
  }

  /** Get current waveform data for visualization */
  getWaveformData(): WaveformData {
    return {
      csiSignal: [...this.rawBuffer],
      breathingSignal: [...this.breathingBuffer],
      heartbeatSignal: [...this.heartbeatBuffer],
      timestamps: [...this.timestampBuffer],
    };
  }

  /** Reset processor state */
  reset(): void {
    this.rawBuffer = [];
    this.breathingBuffer = [];
    this.heartbeatBuffer = [];
    this.timestampBuffer = [];
    this.breathLowState = 0;
    this.breathHighState = 0;
    this.breathPrevInput = 0;
    this.heartLowState = 0;
    this.heartHighState = 0;
    this.heartPrevInput = 0;
  }

  /**
   * Simple first-order IIR bandpass filter.
   * Cascades a low-pass filter (removes frequencies above highCutoff)
   * with a high-pass filter (removes frequencies below lowCutoff).
   * In production, a proper FIR or higher-order IIR filter would be used.
   */
  private bandpassFilter(
    input: number,
    lowCutoff: number,
    highCutoff: number,
    band: 'breath' | 'heart',
  ): number {
    // Low-pass: y[n] = alpha * x[n] + (1 - alpha) * y[n-1]
    const alphaLow = highCutoff / (highCutoff + 1 / (2 * Math.PI));
    // High-pass: y[n] = alpha * (y[n-1] + x[n] - x[n-1])
    const alphaHigh = 1 / (1 + 2 * Math.PI * lowCutoff);

    if (band === 'breath') {
      // Apply low-pass first
      this.breathLowState =
        this.breathLowState + alphaLow * (input - this.breathLowState);
      // Then high-pass on the low-passed signal
      const lowPassed = this.breathLowState;
      const highPassed =
        alphaHigh * (this.breathHighState + lowPassed - this.breathPrevInput);
      this.breathHighState = highPassed;
      this.breathPrevInput = lowPassed;
      return highPassed;
    } else {
      // Apply low-pass first
      this.heartLowState =
        this.heartLowState + alphaLow * (input - this.heartLowState);
      // Then high-pass on the low-passed signal
      const lowPassed = this.heartLowState;
      const highPassed =
        alphaHigh * (this.heartHighState + lowPassed - this.heartPrevInput);
      this.heartHighState = highPassed;
      this.heartPrevInput = lowPassed;
      return highPassed;
    }
  }
}

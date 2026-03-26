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

  // Simple IIR filter states for heartbeat band
  private heartLowState = 0;
  private heartHighState = 0;

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
    this.heartLowState = 0;
    this.heartHighState = 0;
  }

  /**
   * Simple first-order IIR bandpass filter.
   * Uses low-pass and high-pass combination.
   * In production, a proper FIR or higher-order IIR filter would be used.
   */
  private bandpassFilter(
    input: number,
    lowCutoff: number,
    highCutoff: number,
    band: 'breath' | 'heart',
  ): number {
    // Low-pass filter (keeps frequencies below highCutoff)
    const alphaLow = highCutoff / (highCutoff + 1 / (2 * Math.PI));
    // High-pass filter (removes frequencies below lowCutoff)
    const alphaHigh = 1 / (1 + 2 * Math.PI * lowCutoff);

    if (band === 'breath') {
      this.breathLowState =
        this.breathLowState + alphaLow * (input - this.breathLowState);
      const highPassed = alphaHigh * (this.breathHighState + input - this.breathLowState);
      this.breathHighState = highPassed;
      return highPassed;
    } else {
      this.heartLowState =
        this.heartLowState + alphaLow * (input - this.heartLowState);
      const highPassed = alphaHigh * (this.heartHighState + input - this.heartLowState);
      this.heartHighState = highPassed;
      return highPassed;
    }
  }
}

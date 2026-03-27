import { CSISample, CSIEngineConfig, DetectedSubject, VitalSigns, WiFiBoardInfo, RawCSIParams } from '../types';

const DEFAULT_CONFIG: CSIEngineConfig = {
  subcarrierCount: 30,
  sampleRate: 20, // 20 Hz sampling
  targetHeartRate: 72,
  targetRespiratoryRate: 16,
  noiseLevel: 0.15,
};

/**
 * WiFi CSI Simulation Engine
 *
 * Simulates Channel State Information data that would be captured from
 * WiFi signals reflecting off human bodies. Breathing and heartbeat
 * cause periodic variations in the CSI amplitude which can be extracted
 * through signal processing.
 *
 * Based on principles from:
 * - WiFi CSI-based vital signs monitoring research
 * - Fresnel zone model for human body reflection
 */
export class CSIEngine {
  private config: CSIEngineConfig;
  private startTime: number;
  private subjects: Map<string, SubjectSimState>;
  private lastSample: CSISample | null = null;
  private rssi: number = -45;

  /** Static board info (fixed per session, simulated hardware) */
  private readonly boardInfo: WiFiBoardInfo = {
    boardModel: 'ESP32-WROOM-32',
    wifiStandard: '802.11n',
    frequencyBand: '2.4 GHz',
    channel: 6,
    bandwidth: '20 MHz',
    macAddress: 'A4:CF:12:3B:7E:01',
    firmwareVersion: 'v5.1.2-csi',
    subcarrierCount: DEFAULT_CONFIG.subcarrierCount,
    sampleRate: DEFAULT_CONFIG.sampleRate,
    rssi: -45,
  };

  constructor(config: Partial<CSIEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();
    this.subjects = new Map();
    this.initializeSubjects();
  }

  private initializeSubjects(): void {
    // Simulate 1-2 subjects detected in the environment
    const count = Math.random() > 0.5 ? 2 : 1;

    for (let i = 0; i < count; i++) {
      const id = `subject-${i + 1}`;
      const heartRate = 60 + Math.random() * 40; // 60-100 bpm
      const respiratoryRate = 12 + Math.random() * 8; // 12-20 bpm

      this.subjects.set(id, {
        id,
        label: `Subject ${String.fromCharCode(65 + i)}`,
        heartRate,
        respiratoryRate,
        heartRateVariation: 0,
        respiratoryVariation: 0,
        distance: 1.5 + Math.random() * 4, // 1.5-5.5m
        angle: Math.random() * 360,
        movementPhase: 0,
        movementAmplitude: 0,
        lastMovementTime: 0,
      });
    }
  }

  /** Generate a CSI sample for the current time */
  generateSample(): CSISample {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000; // seconds

    const amplitudes: number[] = [];

    for (let sc = 0; sc < this.config.subcarrierCount; sc++) {
      let amplitude = 1.0; // baseline

      // Each subject contributes to the CSI signal
      for (const state of this.subjects.values()) {
        // Breathing component: slow, large amplitude variation
        const breathingFreq = state.respiratoryRate / 60; // Hz
        const breathingContrib =
          0.15 * Math.sin(2 * Math.PI * breathingFreq * elapsed + sc * 0.1);

        // Heartbeat component: faster, smaller amplitude variation
        const heartFreq = state.heartRate / 60; // Hz
        const heartContrib =
          0.04 * Math.sin(2 * Math.PI * heartFreq * elapsed + sc * 0.05);

        // Distance attenuation
        const attenuation = 1 / (1 + state.distance * 0.3);

        // Random body movement (occasional)
        let movementContrib = 0;
        if (state.movementAmplitude > 0.01) {
          movementContrib =
            state.movementAmplitude *
            Math.sin(2 * Math.PI * 0.5 * elapsed + state.movementPhase);
        }

        amplitude +=
          (breathingContrib + heartContrib + movementContrib) * attenuation;
      }

      // Add noise
      amplitude += (Math.random() - 0.5) * 2 * this.config.noiseLevel;

      amplitudes.push(amplitude);
    }

    const meanAmplitude =
      amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;

    const sample: CSISample = { timestamp: now, amplitudes, meanAmplitude };
    this.lastSample = sample;

    // Slowly drift RSSI for realism
    this.rssi += (Math.random() - 0.5) * 0.4;
    this.rssi = Math.max(-75, Math.min(-30, this.rssi));
    this.boardInfo.rssi = Math.round(this.rssi);

    return sample;
  }

  /** Update subject simulation state (called periodically) */
  updateSubjects(): void {
    const now = Date.now();

    for (const state of this.subjects.values()) {
      // Slowly vary heart rate and respiratory rate for realism
      state.heartRateVariation += (Math.random() - 0.5) * 0.5;
      state.heartRateVariation = Math.max(
        -5,
        Math.min(5, state.heartRateVariation),
      );
      state.heartRate = Math.max(
        55,
        Math.min(
          105,
          this.config.targetHeartRate + state.heartRateVariation,
        ),
      );

      state.respiratoryVariation += (Math.random() - 0.5) * 0.2;
      state.respiratoryVariation = Math.max(
        -3,
        Math.min(3, state.respiratoryVariation),
      );
      state.respiratoryRate = Math.max(
        10,
        Math.min(
          22,
          this.config.targetRespiratoryRate + state.respiratoryVariation,
        ),
      );

      // Occasional random body movement
      if (now - state.lastMovementTime > 8000 && Math.random() > 0.98) {
        state.movementAmplitude = 0.2 + Math.random() * 0.3;
        state.movementPhase = Math.random() * Math.PI * 2;
        state.lastMovementTime = now;
      }

      // Decay movement amplitude
      state.movementAmplitude *= 0.995;

      // Subtle position drift
      state.angle += (Math.random() - 0.5) * 0.3;
      state.angle = ((state.angle % 360) + 360) % 360;
      state.distance += (Math.random() - 0.5) * 0.02;
      state.distance = Math.max(1, Math.min(8, state.distance));
    }
  }

  /** Get current detected subjects with their vital signs */
  getDetectedSubjects(): DetectedSubject[] {
    return Array.from(this.subjects.values()).map((state) => {
      const movementIndex = Math.min(
        100,
        Math.round(state.movementAmplitude * 200),
      );

      const vitals: VitalSigns = {
        heartRate: Math.round(state.heartRate),
        respiratoryRate: Math.round(state.respiratoryRate),
        movementIndex,
        presenceDetected: true,
        confidence: Math.max(
          60,
          Math.round(95 - state.distance * 5 + (Math.random() - 0.5) * 4),
        ),
      };

      return {
        id: state.id,
        label: state.label,
        distance: Math.round(state.distance * 10) / 10,
        angle: Math.round(state.angle),
        vitals,
        lastUpdated: Date.now(),
      };
    });
  }

  /** Get simulated WiFi board hardware information */
  getWifiBoardInfo(): WiFiBoardInfo {
    return { ...this.boardInfo };
  }

  /** Get raw CSI parameters from the most recent sample */
  getLastRawCSIParams(): RawCSIParams | null {
    if (!this.lastSample) return null;
    const { timestamp, amplitudes, meanAmplitude } = this.lastSample;
    const min = Math.min(...amplitudes);
    const max = Math.max(...amplitudes);
    const variance =
      amplitudes.reduce((sum, v) => sum + (v - meanAmplitude) ** 2, 0) /
      amplitudes.length;
    return {
      timestamp,
      meanAmplitude: Math.round(meanAmplitude * 1000) / 1000,
      minAmplitude: Math.round(min * 1000) / 1000,
      maxAmplitude: Math.round(max * 1000) / 1000,
      amplitudeVariance: Math.round(variance * 1000) / 1000,
      subcarrierCount: amplitudes.length,
      subcarrierPreview: amplitudes.slice(0, 8).map((v) => Math.round(v * 1000) / 1000),
    };
  }

  /** Reset the engine with new subjects */
  reset(): void {
    this.startTime = Date.now();
    this.subjects.clear();
    this.initializeSubjects();
  }
}

interface SubjectSimState {
  id: string;
  label: string;
  heartRate: number;
  respiratoryRate: number;
  heartRateVariation: number;
  respiratoryVariation: number;
  distance: number;
  angle: number;
  movementPhase: number;
  movementAmplitude: number;
  lastMovementTime: number;
}

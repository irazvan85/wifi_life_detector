/** Represents a single WiFi CSI (Channel State Information) sample */
export interface CSISample {
  timestamp: number;
  /** Amplitude values across subcarriers */
  amplitudes: number[];
  /** Mean amplitude used for vital signs extraction */
  meanAmplitude: number;
}

/** Extracted vital signs from CSI data processing */
export interface VitalSigns {
  heartRate: number; // beats per minute (60-100 normal)
  respiratoryRate: number; // breaths per minute (12-20 normal)
  movementIndex: number; // 0-100 scale
  presenceDetected: boolean;
  confidence: number; // 0-100 percentage
}

/** A detected human subject with position and vitals */
export interface DetectedSubject {
  id: string;
  label: string;
  distance: number; // meters from sensor
  angle: number; // degrees (0-360)
  vitals: VitalSigns;
  lastUpdated: number;
}

/** Real-time waveform data for visualization */
export interface WaveformData {
  /** Raw CSI amplitude signal */
  csiSignal: number[];
  /** Extracted breathing waveform */
  breathingSignal: number[];
  /** Extracted heartbeat waveform */
  heartbeatSignal: number[];
  /** Timestamps for the samples */
  timestamps: number[];
}

/** System monitoring status */
export type MonitoringStatus = 'idle' | 'initializing' | 'monitoring' | 'error';

/** Configuration for the CSI simulation engine */
export interface CSIEngineConfig {
  /** Number of subcarriers to simulate */
  subcarrierCount: number;
  /** Sampling rate in Hz */
  sampleRate: number;
  /** Target heart rate for simulation (bpm) */
  targetHeartRate: number;
  /** Target respiratory rate for simulation (breaths/min) */
  targetRespiratoryRate: number;
  /** Signal noise level (0-1) */
  noiseLevel: number;
}

/** Simulated WiFi board hardware details */
export interface WiFiBoardInfo {
  boardModel: string;
  wifiStandard: string;
  frequencyBand: string;
  channel: number;
  bandwidth: string;
  macAddress: string;
  firmwareVersion: string;
  subcarrierCount: number;
  sampleRate: number;
  /** Received Signal Strength Indicator in dBm */
  rssi: number;
}

/** Raw parameters extracted from the latest CSI sample */
export interface RawCSIParams {
  timestamp: number;
  meanAmplitude: number;
  minAmplitude: number;
  maxAmplitude: number;
  amplitudeVariance: number;
  subcarrierCount: number;
  /** First 8 subcarrier amplitudes as a quick preview */
  subcarrierPreview: number[];
}

/** How the app connects to a CSI data source */
export type ConnectionMethod = 'simulation' | 'websocket' | 'serial';

/** Connection state for hardware adapters */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Configuration for connecting to a hardware board */
export interface HardwareConnectionConfig {
  method: ConnectionMethod;
  /** WebSocket URL (e.g. ws://192.168.1.99:81) */
  websocketUrl: string;
  /** Serial baud rate */
  serialBaudRate: number;
}

/** Events emitted by a hardware adapter */
export interface HardwareAdapterEvents {
  onSample: (sample: CSISample) => void;
  onBoardInfo: (info: WiFiBoardInfo) => void;
  onError: (error: string) => void;
  onStateChange: (state: ConnectionState) => void;
}

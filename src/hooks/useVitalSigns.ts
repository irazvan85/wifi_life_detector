import { useState, useEffect, useRef, useCallback } from 'react';
import { CSIEngine } from '../simulation/csiEngine';
import { VitalSignsProcessor } from '../processing/vitalSignsProcessor';
import { estimateVitalSigns } from '../processing/vitalSignsEstimator';
import { HardwareAdapter } from '../hardware/HardwareAdapter';
import { WebSocketAdapter } from '../hardware/WebSocketAdapter';
import { WebSerialAdapter } from '../hardware/WebSerialAdapter';
import {
  CSISample,
  DetectedSubject,
  WaveformData,
  MonitoringStatus,
  WiFiBoardInfo,
  RawCSIParams,
  ConnectionMethod,
  ConnectionState,
} from '../types';

interface UseVitalSignsReturn {
  status: MonitoringStatus;
  subjects: DetectedSubject[];
  waveform: WaveformData;
  boardInfo: WiFiBoardInfo | null;
  rawCSIParams: RawCSIParams | null;
  /** True when using simulated data, false when connected to real hardware */
  isSimulated: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;

  /* ---- hardware connection ---- */
  connectionMethod: ConnectionMethod;
  connectionState: ConnectionState;
  connectionError: string | null;
  websocketUrl: string;
  serialBaudRate: number;
  setConnectionMethod: (m: ConnectionMethod) => void;
  setWebsocketUrl: (url: string) => void;
  setSerialBaudRate: (rate: number) => void;
  connectHardware: () => void;
  disconnectHardware: () => void;
}

const EMPTY_WAVEFORM: WaveformData = {
  csiSignal: [],
  breathingSignal: [],
  heartbeatSignal: [],
  timestamps: [],
};

/**
 * Custom hook that manages the vital signs monitoring lifecycle.
 * Supports both simulated CSI data and real hardware via WebSocket
 * or Web Serial adapters.
 */
export function useVitalSigns(): UseVitalSignsReturn {
  const [status, setStatus] = useState<MonitoringStatus>('idle');
  const [subjects, setSubjects] = useState<DetectedSubject[]>([]);
  const [waveform, setWaveform] = useState<WaveformData>(EMPTY_WAVEFORM);
  const [boardInfo, setBoardInfo] = useState<WiFiBoardInfo | null>(null);
  const [rawCSIParams, setRawCSIParams] = useState<RawCSIParams | null>(null);

  // Connection state
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('simulation');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [websocketUrl, setWebsocketUrl] = useState('ws://192.168.4.1:81');
  const [serialBaudRate, setSerialBaudRate] = useState(115200);

  const engineRef = useRef<CSIEngine | null>(null);
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const adapterRef = useRef<HardwareAdapter | null>(null);
  const sampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hwCleanupRef = useRef<(() => void) | null>(null);

  const isSimulated = connectionMethod === 'simulation';

  /* ---- cleanup helpers ---- */

  const clearIntervals = useCallback(() => {
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  /* ---- hardware connection ---- */

  const connectHardware = useCallback(() => {
    if (connectionMethod === 'simulation') return;

    setConnectionError(null);
    let adapter: HardwareAdapter;

    if (connectionMethod === 'websocket') {
      adapter = new WebSocketAdapter(websocketUrl);
    } else {
      adapter = new WebSerialAdapter(serialBaudRate);
    }

    adapterRef.current = adapter;

    adapter.onStateChange((s) => setConnectionState(s));
    adapter.onError((e) => setConnectionError(e));
    adapter.onBoardInfo((info) => setBoardInfo(info));

    adapter.connect().catch(() => {
      /* errors surfaced via onError */
    });
  }, [connectionMethod, websocketUrl, serialBaudRate]);

  const disconnectHardware = useCallback(() => {
    adapterRef.current?.disconnect();
    adapterRef.current = null;
    setConnectionState('disconnected');
    setConnectionError(null);
  }, []);

  /* ---- monitoring lifecycle ---- */

  const startMonitoring = useCallback(() => {
    setStatus('initializing');

    const processor = new VitalSignsProcessor();
    processorRef.current = processor;

    if (isSimulated) {
      /* ---------- SIMULATION PATH ---------- */
      const engine = new CSIEngine();
      engineRef.current = engine;

      setTimeout(() => {
        setStatus('monitoring');

        // Generate CSI samples at 20 Hz
        sampleIntervalRef.current = setInterval(() => {
          const sample = engine.generateSample();
          processor.addSample(sample.meanAmplitude, sample.timestamp);
        }, 50);

        // Update UI state at 4 Hz
        updateIntervalRef.current = setInterval(() => {
          engine.updateSubjects();
          setSubjects(engine.getDetectedSubjects());
          setWaveform(processor.getWaveformData());
          setBoardInfo(engine.getWifiBoardInfo());
          setRawCSIParams(engine.getLastRawCSIParams());
        }, 250);
      }, 1500);
    } else {
      /* ---------- HARDWARE PATH ---------- */
      const adapter = adapterRef.current;
      if (!adapter || adapter.getState() !== 'connected') {
        setStatus('error');
        return;
      }

      // Feed incoming CSI samples into the processor
      const unsubSample = adapter.onSample((sample: CSISample) => {
        processor.addSample(sample.meanAmplitude, sample.timestamp);

        // Compute raw CSI params from the hardware sample
        const { timestamp, amplitudes, meanAmplitude } = sample;
        const min = Math.min(...amplitudes);
        const max = Math.max(...amplitudes);
        const variance =
          amplitudes.reduce((sum, v) => sum + (v - meanAmplitude) ** 2, 0) /
          (amplitudes.length || 1);
        setRawCSIParams({
          timestamp,
          meanAmplitude: Math.round(meanAmplitude * 1000) / 1000,
          minAmplitude: Math.round(min * 1000) / 1000,
          maxAmplitude: Math.round(max * 1000) / 1000,
          amplitudeVariance: Math.round(variance * 1000) / 1000,
          subcarrierCount: amplitudes.length,
          subcarrierPreview: amplitudes
            .slice(0, 8)
            .map((v) => Math.round(v * 1000) / 1000),
        });
      });

      // Update UI at 4 Hz – derive subjects from processed waveforms
      updateIntervalRef.current = setInterval(() => {
        const w = processor.getWaveformData();
        setWaveform(w);

        const vitals = estimateVitalSigns(w);
        setSubjects(
          vitals.presenceDetected
            ? [
                {
                  id: 'hw-subject-1',
                  label: 'Subject A',
                  distance: 0,
                  angle: 0,
                  vitals,
                  lastUpdated: Date.now(),
                },
              ]
            : [],
        );
      }, 250);

      // Store unsubscribe so cleanup can call it
      hwCleanupRef.current = () => unsubSample();

      setStatus('monitoring');
    }
  }, [isSimulated, clearIntervals]);

  const stopMonitoring = useCallback(() => {
    clearIntervals();
    // Clean up hardware sample listener if present
    if (hwCleanupRef.current) {
      hwCleanupRef.current();
      hwCleanupRef.current = null;
    }
    engineRef.current = null;
    processorRef.current?.reset();
    processorRef.current = null;
    setStatus('idle');
    setSubjects([]);
    setWaveform(EMPTY_WAVEFORM);
    setBoardInfo(null);
    setRawCSIParams(null);
  }, [clearIntervals]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearIntervals();
      adapterRef.current?.disconnect();
    };
  }, [clearIntervals]);

  return {
    status,
    subjects,
    waveform,
    boardInfo,
    rawCSIParams,
    isSimulated,
    startMonitoring,
    stopMonitoring,
    connectionMethod,
    connectionState,
    connectionError,
    websocketUrl,
    serialBaudRate,
    setConnectionMethod,
    setWebsocketUrl,
    setSerialBaudRate,
    connectHardware,
    disconnectHardware,
  };
}

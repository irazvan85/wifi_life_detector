import { useState, useEffect, useRef, useCallback } from 'react';
import { CSIEngine } from '../simulation/csiEngine';
import { VitalSignsProcessor } from '../processing/vitalSignsProcessor';
import {
  DetectedSubject,
  WaveformData,
  MonitoringStatus,
} from '../types';

interface UseVitalSignsReturn {
  status: MonitoringStatus;
  subjects: DetectedSubject[];
  waveform: WaveformData;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

/**
 * Custom hook that manages the vital signs monitoring lifecycle.
 * Coordinates the CSI engine (data generation) and the signal processor
 * (vital signs extraction) and provides reactive state to components.
 */
export function useVitalSigns(): UseVitalSignsReturn {
  const [status, setStatus] = useState<MonitoringStatus>('idle');
  const [subjects, setSubjects] = useState<DetectedSubject[]>([]);
  const [waveform, setWaveform] = useState<WaveformData>({
    csiSignal: [],
    breathingSignal: [],
    heartbeatSignal: [],
    timestamps: [],
  });

  const engineRef = useRef<CSIEngine | null>(null);
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const sampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  const startMonitoring = useCallback(() => {
    setStatus('initializing');

    // Initialize engine and processor
    const engine = new CSIEngine();
    const processor = new VitalSignsProcessor();
    engineRef.current = engine;
    processorRef.current = processor;

    // Short delay to simulate initialization
    setTimeout(() => {
      setStatus('monitoring');

      // Generate CSI samples at 20Hz
      sampleIntervalRef.current = setInterval(() => {
        const sample = engine.generateSample();
        processor.addSample(sample.meanAmplitude, sample.timestamp);
      }, 50); // 20Hz

      // Update UI state at 4Hz (every 250ms)
      updateIntervalRef.current = setInterval(() => {
        engine.updateSubjects();
        setSubjects(engine.getDetectedSubjects());
        setWaveform(processor.getWaveformData());
      }, 250);
    }, 1500);
  }, []);

  const stopMonitoring = useCallback(() => {
    cleanup();
    engineRef.current = null;
    processorRef.current?.reset();
    processorRef.current = null;
    setStatus('idle');
    setSubjects([]);
    setWaveform({
      csiSignal: [],
      breathingSignal: [],
      heartbeatSignal: [],
      timestamps: [],
    });
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { status, subjects, waveform, startMonitoring, stopMonitoring };
}

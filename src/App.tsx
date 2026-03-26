import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Heart,
  Wind,
  Move,
  Shield,
  Power,
  Wifi,
  Radio,
  Users,
} from 'lucide-react';
import { useVitalSigns } from './hooks/useVitalSigns';
import { RadarDisplay } from './components/RadarDisplay';
import { WaveformChart } from './components/WaveformChart';
import { VitalCard } from './components/VitalCard';
import { DetectedSubject } from './types';

export default function App() {
  const { status, subjects, waveform, startMonitoring, stopMonitoring } =
    useVitalSigns();

  const isActive = status === 'monitoring';
  const primarySubject: DetectedSubject | undefined = subjects[0];

  const getVitalStatus = (
    type: 'hr' | 'rr' | 'movement',
  ): 'normal' | 'warning' | 'inactive' => {
    if (!isActive || !primarySubject) return 'inactive';
    if (type === 'hr') {
      const hr = primarySubject.vitals.heartRate;
      return hr < 50 || hr > 110 ? 'warning' : 'normal';
    }
    if (type === 'rr') {
      const rr = primarySubject.vitals.respiratoryRate;
      return rr < 10 || rr > 24 ? 'warning' : 'normal';
    }
    return primarySubject.vitals.movementIndex > 50 ? 'warning' : 'normal';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-green-900/50 p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold text-green-400 flex items-center gap-3 tracking-tighter">
            <Activity className="w-6 h-6" />
            VITAL_SCAN // WIFI_LIFE_DETECTOR
          </h1>
          <p className="text-zinc-500 font-mono text-xs mt-1 uppercase tracking-widest">
            WiFi CSI-Based Vital Signs Monitoring
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-2 rounded-lg border border-zinc-800/50">
            <Wifi
              className={`w-4 h-4 ${isActive ? 'text-green-400' : 'text-zinc-600'}`}
            />
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
              {status === 'idle'
                ? 'Standby'
                : status === 'initializing'
                  ? 'Calibrating...'
                  : `${subjects.length} Subject${subjects.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          <button
            onClick={isActive || status === 'initializing' ? stopMonitoring : startMonitoring}
            disabled={status === 'initializing'}
            className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
              isActive
                ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20'
                : 'bg-green-500/10 text-green-500 border border-green-500/50 hover:bg-green-500/20'
            }`}
          >
            <Power className="w-4 h-4" />
            {status === 'initializing'
              ? 'Init...'
              : isActive
                ? 'Stop'
                : 'Start Monitor'}
          </button>
        </div>
      </header>

      {/* Info Banner */}
      {status === 'idle' && (
        <div className="w-full max-w-6xl mb-6 bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-4 flex items-start gap-3">
          <Radio className="w-5 h-5 shrink-0 mt-0.5 text-green-500" />
          <div className="text-sm text-zinc-400">
            <strong className="block text-green-400 font-medium mb-1 font-mono text-xs uppercase">
              WiFi CSI Vital Signs Detection
            </strong>
            This application uses WiFi Channel State Information (CSI) to detect
            human presence and extract vital signs. WiFi signals reflected off
            the human body carry micro-variations caused by breathing and
            heartbeat. Signal processing extracts these patterns to estimate
            heart rate, respiratory rate, and body movement without any wearable
            sensors.
            <br />
            <span className="text-zinc-500 text-xs mt-1 inline-block">
              Press <strong className="text-green-400">Start Monitor</strong> to
              begin CSI analysis with simulated sensor data.
            </span>
          </div>
        </div>
      )}

      {/* Main Dashboard */}
      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Radar + Subject Details */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <RadarDisplay subjects={subjects} status={status} />

          {/* Subject List */}
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl overflow-hidden">
            <div className="p-3 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/80">
              <h2 className="font-mono text-[10px] text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                Detected Subjects
              </h2>
              <span className="font-mono text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                {subjects.length}
              </span>
            </div>
            <div className="p-2 max-h-[200px] overflow-y-auto">
              {subjects.length === 0 ? (
                <div className="text-center text-zinc-600 font-mono text-[10px] uppercase py-6 tracking-widest">
                  {isActive ? 'Scanning...' : 'No subjects'}
                </div>
              ) : (
                <AnimatePresence>
                  {subjects.map((subject) => (
                    <motion.div
                      key={subject.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-zinc-950/50 border border-zinc-800/30 rounded-lg p-3 mb-1"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-mono text-xs text-cyan-300 font-bold">
                          {subject.label}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {subject.distance}m away
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
                        <div>
                          <span className="text-zinc-500">HR</span>
                          <span className="ml-1 text-green-300">
                            {subject.vitals.heartRate} bpm
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500">RR</span>
                          <span className="ml-1 text-blue-300">
                            {subject.vitals.respiratoryRate} br/m
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Conf</span>
                          <span className="ml-1 text-zinc-300">
                            {subject.vitals.confidence}%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Vitals + Waveforms */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Vital Signs Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <VitalCard
              icon={Heart}
              label="Heart Rate"
              value={
                isActive && primarySubject
                  ? String(primarySubject.vitals.heartRate)
                  : '--'
              }
              unit="bpm"
              status={getVitalStatus('hr')}
              animate={isActive}
            />
            <VitalCard
              icon={Wind}
              label="Resp. Rate"
              value={
                isActive && primarySubject
                  ? String(primarySubject.vitals.respiratoryRate)
                  : '--'
              }
              unit="br/min"
              status={getVitalStatus('rr')}
            />
            <VitalCard
              icon={Move}
              label="Movement"
              value={
                isActive && primarySubject
                  ? String(primarySubject.vitals.movementIndex)
                  : '--'
              }
              unit="idx"
              status={getVitalStatus('movement')}
            />
            <VitalCard
              icon={Shield}
              label="Confidence"
              value={
                isActive && primarySubject
                  ? String(primarySubject.vitals.confidence)
                  : '--'
              }
              unit="%"
              status={isActive && primarySubject ? 'normal' : 'inactive'}
            />
          </div>

          {/* Presence Detection Bar */}
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                Life Presence Indicator
              </span>
              <span
                className={`font-mono text-xs font-bold uppercase ${
                  isActive && primarySubject?.vitals.presenceDetected
                    ? 'text-green-400'
                    : 'text-zinc-600'
                }`}
              >
                {isActive && primarySubject?.vitals.presenceDetected
                  ? '● DETECTED'
                  : '○ NONE'}
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-500"
                initial={{ width: 0 }}
                animate={{
                  width:
                    isActive && primarySubject
                      ? `${primarySubject.vitals.confidence}%`
                      : '0%',
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Waveform Charts */}
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4">
            <h2 className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Real-Time Signal Analysis
            </h2>
            <div className="flex flex-col gap-3">
              <WaveformChart
                data={waveform.csiSignal}
                label="CSI Amplitude (Raw)"
                color="rgba(34, 197, 94, 0.9)"
                height={70}
              />
              <WaveformChart
                data={waveform.breathingSignal}
                label="Breathing Waveform (0.1–0.5 Hz)"
                color="rgba(96, 165, 250, 0.9)"
                height={70}
              />
              <WaveformChart
                data={waveform.heartbeatSignal}
                label="Heartbeat Waveform (0.8–2.0 Hz)"
                color="rgba(248, 113, 113, 0.9)"
                height={70}
              />
            </div>
          </div>

          {/* Technical Info */}
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4 font-mono text-[10px] text-zinc-500 grid grid-cols-2 md:grid-cols-4 gap-3"
            >
              <div>
                <span className="block text-zinc-600 uppercase">
                  Sample Rate
                </span>
                <span className="text-zinc-400">20 Hz</span>
              </div>
              <div>
                <span className="block text-zinc-600 uppercase">
                  Subcarriers
                </span>
                <span className="text-zinc-400">30</span>
              </div>
              <div>
                <span className="block text-zinc-600 uppercase">
                  Buffer Size
                </span>
                <span className="text-zinc-400">
                  {waveform.csiSignal.length} / 200
                </span>
              </div>
              <div>
                <span className="block text-zinc-600 uppercase">
                  Detection Range
                </span>
                <span className="text-zinc-400">1–8 m</span>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mt-8 pt-4 border-t border-zinc-800/30 flex justify-between items-center font-mono text-[10px] text-zinc-600 uppercase">
        <span>VitalScan WiFi Life Detector v1.0</span>
        <span>WiFi CSI-Based Contactless Monitoring</span>
      </footer>
    </div>
  );
}

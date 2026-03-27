import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DetectedSubject, MonitoringStatus } from '../types';

interface RadarDisplayProps {
  subjects: DetectedSubject[];
  status: MonitoringStatus;
}

export function RadarDisplay({ subjects, status }: RadarDisplayProps) {
  const isActive = status === 'monitoring';

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 sm:p-6 relative overflow-hidden flex flex-col items-center justify-center min-h-[320px] sm:min-h-[400px]">
      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 font-mono text-[10px] sm:text-xs text-zinc-500 uppercase tracking-widest">
        CSI_Spatial_Map
      </div>
      <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`}
        />
        <span className="font-mono text-[10px] text-zinc-500 uppercase">
          {status === 'idle'
            ? 'Offline'
            : status === 'initializing'
              ? 'Init...'
              : 'Live'}
        </span>
      </div>

      {/* The Radar Circle - responsive sizing */}
      <div className="relative w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-full border border-green-500/20 radar-bg flex items-center justify-center">
        {/* Concentric rings with distance labels */}
        <div className="absolute w-3/4 h-3/4 rounded-full border border-green-500/10" />
        <div className="absolute w-1/2 h-1/2 rounded-full border border-green-500/10" />
        <div className="absolute w-1/4 h-1/4 rounded-full border border-green-500/10" />

        {/* Distance labels */}
        <span className="absolute font-mono text-[8px] text-green-500/40" style={{ top: '12%', right: '50%', transform: 'translateX(50%)' }}>
          6m
        </span>
        <span className="absolute font-mono text-[8px] text-green-500/40" style={{ top: '25%', right: '50%', transform: 'translateX(50%)' }}>
          4m
        </span>
        <span className="absolute font-mono text-[8px] text-green-500/40" style={{ top: '37%', right: '50%', transform: 'translateX(50%)' }}>
          2m
        </span>

        {/* Crosshairs */}
        <div className="absolute w-full h-[1px] bg-green-500/10" />
        <div className="absolute h-full w-[1px] bg-green-500/10" />

        {/* Sweep Animation */}
        {isActive && (
          <motion.div
            className="absolute w-full h-full radar-sweep origin-center"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* Subject Blips */}
        <AnimatePresence>
          {subjects.map((subject) => {
            const maxDistance = 8;
            const radiusPercent = Math.min(
              (subject.distance / maxDistance) * 48,
              48,
            );
            const rad = (subject.angle - 90) * (Math.PI / 180);
            const x = 50 + radiusPercent * Math.cos(rad);
            const y = 50 + radiusPercent * Math.sin(rad);

            return (
              <motion.div
                key={subject.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute flex flex-col items-center"
                style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
              >
                {/* Blip */}
                <div className="w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)] flex items-center justify-center relative">
                  <div className="absolute w-full h-full rounded-full bg-cyan-400 animate-ping opacity-50" />
                  <div className="w-1.5 h-1.5 bg-zinc-950 rounded-full z-10" />
                </div>
                {/* Label */}
                <span className="mt-1 font-mono text-[9px] text-cyan-300/80 whitespace-nowrap">
                  {subject.label}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Center Node (Sensor) */}
        <div className="absolute w-5 h-5 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,1)] z-10 flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-zinc-950 rounded-full" />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 sm:mt-4 flex gap-4 font-mono text-[11px] sm:text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Sensor
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400" /> Subject
        </span>
      </div>
    </div>
  );
}

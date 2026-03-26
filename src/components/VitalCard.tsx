import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface VitalCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
  status: 'normal' | 'warning' | 'inactive';
  animate?: boolean;
}

const statusColors = {
  normal: {
    icon: 'text-green-400',
    border: 'border-green-500/20',
    bg: 'bg-green-500/5',
    value: 'text-green-100',
    glow: 'shadow-[0_0_15px_rgba(34,197,94,0.1)]',
  },
  warning: {
    icon: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
    value: 'text-amber-100',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.1)]',
  },
  inactive: {
    icon: 'text-zinc-600',
    border: 'border-zinc-800/50',
    bg: 'bg-zinc-900/40',
    value: 'text-zinc-500',
    glow: '',
  },
};

export function VitalCard({
  icon: Icon,
  label,
  value,
  unit,
  status,
  animate = false,
}: VitalCardProps) {
  const colors = statusColors[status];

  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 ${colors.border} ${colors.bg} ${colors.glow} transition-all`}
    >
      <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
        <Icon
          className={`w-4 h-4 sm:w-4 sm:h-4 ${colors.icon} ${animate ? 'animate-pulse' : ''}`}
        />
        <span className="font-mono text-[10px] sm:text-[11px] text-zinc-500 uppercase tracking-widest">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <motion.span
          key={value}
          initial={{ opacity: 0.7, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-xl sm:text-2xl font-mono font-light ${colors.value}`}
        >
          {value}
        </motion.span>
        <span className="text-[11px] sm:text-xs font-mono text-zinc-500">{unit}</span>
      </div>
    </div>
  );
}

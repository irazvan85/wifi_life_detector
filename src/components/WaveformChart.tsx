import React, { useRef, useEffect } from 'react';

interface WaveformChartProps {
  data: number[];
  label: string;
  color: string;
  height?: number;
}

/**
 * Canvas-based real-time waveform visualization.
 * Renders a scrolling line chart of signal amplitude data.
 */
export function WaveformChart({
  data,
  label,
  color,
  height = 80,
}: WaveformChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.06)';
    ctx.lineWidth = 0.5;
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Find data range for normalization
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 0.1;

    // Draw waveform
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    const step = w / (data.length - 1);
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - min) / range;
      const y = h * (1 - padding) - normalized * h * (1 - 2 * padding);
      if (i === 0) {
        ctx.moveTo(i * step, y);
      } else {
        ctx.lineTo(i * step, y);
      }
    }
    ctx.stroke();

    // Glow effect
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - min) / range;
      const y = h * (1 - padding) - normalized * h * (1 - 2 * padding);
      if (i === 0) {
        ctx.moveTo(i * step, y);
      } else {
        ctx.lineTo(i * step, y);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [data, color, height]);

  return (
    <div className="bg-zinc-950/50 border border-zinc-800/30 rounded-lg p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
          {label}
        </span>
        {data.length > 0 && (
          <span className="font-mono text-[10px]" style={{ color }}>
            {data[data.length - 1]?.toFixed(4)}
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}

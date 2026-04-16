import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, Usb, MonitorSmartphone, ChevronDown, ChevronUp, Loader2, Check, X } from 'lucide-react';
import { ConnectionMethod, ConnectionState } from '../types';
import { WebSerialAdapter } from '../hardware/WebSerialAdapter';

interface ConnectionPanelProps {
  method: ConnectionMethod;
  connectionState: ConnectionState;
  connectionError: string | null;
  onMethodChange: (method: ConnectionMethod) => void;
  onWebSocketUrlChange: (url: string) => void;
  onSerialBaudRateChange: (rate: number) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  websocketUrl: string;
  serialBaudRate: number;
}

const STATE_COLORS: Record<ConnectionState, string> = {
  disconnected: 'text-zinc-500',
  connecting: 'text-amber-400',
  connected: 'text-green-400',
  error: 'text-red-400',
};

const STATE_LABELS: Record<ConnectionState, string> = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error',
};

export function ConnectionPanel({
  method,
  connectionState,
  connectionError,
  onMethodChange,
  onWebSocketUrlChange,
  onSerialBaudRateChange,
  onConnect,
  onDisconnect,
  websocketUrl,
  serialBaudRate,
}: ConnectionPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const isHardware = method !== 'simulation';
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';
  const serialSupported = WebSerialAdapter.isSupported();

  return (
    <div className="w-full max-w-6xl mb-4 sm:mb-6">
      {/* Collapsed bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-zinc-900/60 border border-zinc-800/50 rounded-lg px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-900/80 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {method === 'simulation' && <MonitorSmartphone className="w-4 h-4 text-amber-400 shrink-0" />}
          {method === 'websocket' && <Wifi className="w-4 h-4 text-cyan-400 shrink-0" />}
          {method === 'serial' && <Usb className="w-4 h-4 text-purple-400 shrink-0" />}
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-400 truncate">
            {method === 'simulation' ? 'Simulation Mode' : method === 'websocket' ? 'WebSocket (WiFi)' : 'USB Serial'}
          </span>
          {isHardware && (
            <span className={`font-mono text-[10px] uppercase ${STATE_COLORS[connectionState]}`}>
              {STATE_LABELS[connectionState]}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />}
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-zinc-900/40 border border-t-0 border-zinc-800/50 rounded-b-lg p-3 sm:p-4 space-y-4">
              {/* Method selector */}
              <div>
                <label className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-2">
                  Data Source
                </label>
                <div className="flex flex-wrap gap-2">
                  <MethodButton
                    active={method === 'simulation'}
                    icon={<MonitorSmartphone className="w-3.5 h-3.5" />}
                    label="Simulation"
                    color="amber"
                    onClick={() => onMethodChange('simulation')}
                    disabled={isConnected || isConnecting}
                  />
                  <MethodButton
                    active={method === 'websocket'}
                    icon={<Wifi className="w-3.5 h-3.5" />}
                    label="WebSocket"
                    sublabel="WiFi"
                    color="cyan"
                    onClick={() => onMethodChange('websocket')}
                    disabled={isConnected || isConnecting}
                  />
                  <MethodButton
                    active={method === 'serial'}
                    icon={<Usb className="w-3.5 h-3.5" />}
                    label="USB Serial"
                    color="purple"
                    onClick={() => onMethodChange('serial')}
                    disabled={isConnected || isConnecting || !serialSupported}
                    tooltip={!serialSupported ? 'Web Serial is only available in Chrome/Edge on desktop' : undefined}
                  />
                </div>
              </div>

              {/* WebSocket config */}
              {method === 'websocket' && (
                <div>
                  <label className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
                    Board WebSocket URL
                  </label>
                  <input
                    type="text"
                    value={websocketUrl}
                    onChange={(e) => onWebSocketUrlChange(e.target.value)}
                    disabled={isConnected || isConnecting}
                    placeholder="ws://192.168.1.99:81"
                    className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-3 py-2 font-mono text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none disabled:opacity-50"
                  />
                  <p className="font-mono text-[10px] text-zinc-600 mt-1">
                    Enter the WebSocket address of your ESP32 CSI board. The board and this device must be on the same network.
                  </p>
                </div>
              )}

              {/* Serial config */}
              {method === 'serial' && (
                <div>
                  <label className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
                    Baud Rate
                  </label>
                  <select
                    value={serialBaudRate}
                    onChange={(e) => onSerialBaudRateChange(Number(e.target.value))}
                    disabled={isConnected || isConnecting}
                    className="bg-zinc-800/60 border border-zinc-700/50 rounded px-3 py-2 font-mono text-xs text-zinc-300 focus:border-purple-500/50 focus:outline-none disabled:opacity-50"
                  >
                    {[9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((r) => (
                      <option key={r} value={r}>
                        {r.toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <p className="font-mono text-[10px] text-zinc-600 mt-1">
                    Connect your ESP32 board via USB. A browser prompt will ask you to choose the serial port.
                  </p>
                </div>
              )}

              {/* Connect / disconnect button */}
              {isHardware && (
                <div className="flex items-center gap-3">
                  {!isConnected && !isConnecting && (
                    <button
                      type="button"
                      onClick={onConnect}
                      className="flex items-center gap-2 px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/50 hover:bg-green-500/20 active:bg-green-500/30 transition-all min-h-[40px]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Connect
                    </button>
                  )}
                  {isConnecting && (
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-2 px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/50 opacity-75 min-h-[40px]"
                    >
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Connecting…
                    </button>
                  )}
                  {isConnected && (
                    <button
                      type="button"
                      onClick={onDisconnect}
                      className="flex items-center gap-2 px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20 active:bg-red-500/30 transition-all min-h-[40px]"
                    >
                      <X className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  )}
                  {connectionState === 'connected' && (
                    <span className="font-mono text-[10px] text-green-400">● Board connected</span>
                  )}
                </div>
              )}

              {/* Error message */}
              {connectionError && (
                <div className="bg-red-950/40 border border-red-600/40 rounded px-3 py-2 font-mono text-[11px] text-red-300">
                  {connectionError}
                </div>
              )}

              {/* Simulation note */}
              {method === 'simulation' && (
                <p className="font-mono text-[10px] text-zinc-600">
                  Using generated demo data. Select <strong className="text-cyan-400">WebSocket</strong> or{' '}
                  <strong className="text-purple-400">USB Serial</strong> to connect a real ESP32 CSI board.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---- small helper ---- */

const ACTIVE_STYLES: Record<string, string> = {
  amber: 'bg-amber-500/15 border-amber-500/60 text-amber-300',
  cyan: 'bg-cyan-500/15 border-cyan-500/60 text-cyan-300',
  purple: 'bg-purple-500/15 border-purple-500/60 text-purple-300',
};

function MethodButton({
  active,
  icon,
  label,
  sublabel,
  color,
  onClick,
  disabled,
  tooltip,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}) {
  const base = active
    ? (ACTIVE_STYLES[color] ?? ACTIVE_STYLES.amber)
    : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-500 hover:bg-zinc-800/60';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-[11px] uppercase tracking-wider transition-colors disabled:opacity-40 ${base}`}
    >
      {icon}
      {label}
      {sublabel && <span className="text-[9px] opacity-60">({sublabel})</span>}
    </button>
  );
}

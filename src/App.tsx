import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radar, 
  Smartphone, 
  Laptop, 
  Watch, 
  Wifi, 
  AlertTriangle, 
  Activity,
  Info,
  Power,
  Settings2
} from 'lucide-react';

// --- Types & Interfaces ---
interface DetectedDevice {
  id: string;
  mac: string;
  type: 'phone' | 'laptop' | 'watch' | 'unknown';
  signal: number; // dBm
  distance: number; // meters (estimated)
  lastSeen: number;
  angle: number; // for radar positioning (0-360)
}

export default function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [devices, setDevices] = useState<DetectedDevice[]>([]);
  const [sweepAngle, setSweepAngle] = useState(0);
  
  // --- Simulation Logic (Demo Mode) ---
  useEffect(() => {
    let scanInterval: NodeJS.Timeout;
    let sweepInterval: NodeJS.Timeout;

    if (isScanning) {
      // Radar sweep animation
      sweepInterval = setInterval(() => {
        setSweepAngle((prev) => (prev + 5) % 360);
      }, 50);

      if (isDemoMode) {
        // Simulate finding devices
        scanInterval = setInterval(() => {
          setDevices((current) => {
            const now = Date.now();
            // Remove old devices
            let updated = current.filter(d => now - d.lastSeen < 10000);
            
            // Randomly add or update a device
            if (Math.random() > 0.6) {
              const types: ('phone' | 'laptop' | 'watch' | 'unknown')[] = ['phone', 'phone', 'watch', 'laptop', 'unknown'];
              const type = types[Math.floor(Math.random() * types.length)];
              const signal = -Math.floor(Math.random() * 60 + 30); // -30 to -90 dBm
              const distance = Math.floor(Math.pow(10, (-27.55 - (20 * Math.log10(2400)) + Math.abs(signal)) / 20) * 10) / 10;
              
              const newDevice: DetectedDevice = {
                id: Math.random().toString(36).substring(7),
                mac: Array.from({length: 6}, () => Math.floor(Math.random()*256).toString(16).padStart(2, '0')).join(':').toUpperCase(),
                type,
                signal,
                distance: Math.min(distance, 50), // cap at 50m for UI
                lastSeen: now,
                angle: Math.floor(Math.random() * 360)
              };
              
              updated = [...updated, newDevice];
            }
            return updated;
          });
        }, 1500);
      }
    } else {
      setDevices([]);
    }

    return () => {
      clearInterval(scanInterval);
      clearInterval(sweepInterval);
    };
  }, [isScanning, isDemoMode]);

  // --- Derived Metrics ---
  const activeDevices = devices.length;
  const humanProbability = Math.min(Math.round((devices.filter(d => d.type === 'phone' || d.type === 'watch').length / 3) * 100), 100);
  
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'phone': return <Smartphone className="w-4 h-4" />;
      case 'laptop': return <Laptop className="w-4 h-4" />;
      case 'watch': return <Watch className="w-4 h-4" />;
      default: return <Wifi className="w-4 h-4" />;
    }
  };

  const getSignalColor = (signal: number) => {
    if (signal > -50) return 'text-green-400';
    if (signal > -70) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-green-900/50 p-4 md:p-8 flex flex-col items-center">
      
      {/* Header */}
      <header className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold text-green-400 flex items-center gap-3 tracking-tighter">
            <Activity className="w-6 h-6" />
            VITAL_SCAN // PRESENCE_DETECTOR
          </h1>
          <p className="text-zinc-500 font-mono text-xs mt-1 uppercase tracking-widest">
            Local Network & RF Proximity Analysis
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50">
          <label className="flex items-center gap-2 cursor-pointer">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={isDemoMode}
                onChange={(e) => {
                  setIsDemoMode(e.target.checked);
                  if (!e.target.checked) setDevices([]);
                }}
              />
              <div className={`block w-10 h-6 rounded-full transition-colors ${isDemoMode ? 'bg-green-600' : 'bg-zinc-700'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isDemoMode ? 'translate-x-4' : ''}`}></div>
            </div>
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">Demo Mode</span>
          </label>
          
          <button 
            onClick={() => setIsScanning(!isScanning)}
            className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-sm font-bold uppercase tracking-wider transition-all ${
              isScanning 
                ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20' 
                : 'bg-green-500/10 text-green-500 border border-green-500/50 hover:bg-green-500/20'
            }`}
          >
            <Power className="w-4 h-4" />
            {isScanning ? 'Stop Scan' : 'Init Scan'}
          </button>
        </div>
      </header>

      {/* Browser Limitation Warning */}
      {!isDemoMode && (
        <div className="w-full max-w-5xl mb-8 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3 text-amber-200/80">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
          <div className="text-sm">
            <strong className="block text-amber-500 font-medium mb-1">Browser Sandbox Limitation</strong>
            Web applications cannot directly access native Wi-Fi scanning APIs (like probing MAC addresses or listing nearby SSIDs) due to security restrictions. To build a real version of this app, you would need a native wrapper (e.g., React Native, Flutter) or a local backend service running on the device. 
            <br className="mb-2" />
            Please enable <strong>Demo Mode</strong> above to visualize how this interface would function with real sensor data.
          </div>
        </div>
      )}

      {/* Main Dashboard */}
      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Radar Section */}
        <div className="lg:col-span-7 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
          <div className="absolute top-4 left-4 font-mono text-xs text-zinc-500 uppercase tracking-widest">
            RF_TOPOLOGY_MAP
          </div>
          
          {/* The Radar Circle */}
          <div className="relative w-72 h-72 md:w-96 md:h-96 rounded-full border border-green-500/20 radar-bg flex items-center justify-center">
            {/* Concentric rings */}
            <div className="absolute w-3/4 h-3/4 rounded-full border border-green-500/10"></div>
            <div className="absolute w-1/2 h-1/2 rounded-full border border-green-500/10"></div>
            <div className="absolute w-1/4 h-1/4 rounded-full border border-green-500/10"></div>
            
            {/* Crosshairs */}
            <div className="absolute w-full h-[1px] bg-green-500/10"></div>
            <div className="absolute h-full w-[1px] bg-green-500/10"></div>

            {/* Sweep Animation */}
            {isScanning && (
              <motion.div 
                className="absolute w-full h-full radar-sweep origin-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
            )}

            {/* Device Blips */}
            <AnimatePresence>
              {devices.map((device) => {
                // Calculate position based on distance (radius) and angle
                // Max distance for UI is 50m, so radius is (distance / 50) * 50%
                const radiusPercent = (device.distance / 50) * 50;
                const rad = (device.angle - 90) * (Math.PI / 180);
                const x = 50 + radiusPercent * Math.cos(rad);
                const y = 50 + radiusPercent * Math.sin(rad);

                return (
                  <motion.div
                    key={device.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(34,197,94,0.8)]"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div className="absolute w-full h-full rounded-full bg-green-400 animate-ping opacity-75"></div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Center Node (You) */}
            <div className="absolute w-4 h-4 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,1)] z-10 flex items-center justify-center">
              <div className="w-1 h-1 bg-zinc-950 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Stats & List Section */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Probability Score */}
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="font-mono text-xs text-zinc-500 uppercase tracking-widest mb-1">Life Probability</h2>
                <div className="text-4xl font-mono font-light text-zinc-100">
                  {isScanning ? `${humanProbability}%` : '--%'}
                </div>
              </div>
              <Activity className={`w-8 h-8 ${isScanning && humanProbability > 50 ? 'text-green-400 animate-pulse' : 'text-zinc-700'}`} />
            </div>
            
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-green-500"
                initial={{ width: 0 }}
                animate={{ width: isScanning ? `${humanProbability}%` : '0%' }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="mt-3 flex justify-between font-mono text-[10px] text-zinc-500 uppercase">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {/* Device Log */}
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl flex-1 flex flex-col overflow-hidden min-h-[300px]">
            <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/80">
              <h2 className="font-mono text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Radar className="w-4 h-4" />
                Detected Signatures
              </h2>
              <span className="font-mono text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                {activeDevices} Nodes
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {!isScanning ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 font-mono text-xs uppercase tracking-widest p-8 text-center">
                  <Settings2 className="w-8 h-8 mb-3 opacity-20" />
                  System Standby.<br/>Initialize scan to detect nearby devices.
                </div>
              ) : devices.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 font-mono text-xs uppercase tracking-widest p-8 text-center">
                  <Radar className="w-8 h-8 mb-3 opacity-20 animate-spin-slow" />
                  Scanning frequencies...<br/>No signatures detected yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <AnimatePresence>
                    {devices.sort((a, b) => a.distance - b.distance).map(device => (
                      <motion.div 
                        key={device.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-3 flex items-center gap-4"
                      >
                        <div className={`p-2 rounded-md bg-zinc-900 border border-zinc-800 ${getSignalColor(device.signal)}`}>
                          {getDeviceIcon(device.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="font-mono text-xs text-zinc-300 font-bold truncate">
                              {device.mac}
                            </span>
                            <span className="font-mono text-[10px] text-zinc-500 uppercase">
                              {device.type}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center font-mono text-[10px]">
                            <span className="text-zinc-500 flex items-center gap-1">
                              Signal: <span className={getSignalColor(device.signal)}>{device.signal} dBm</span>
                            </span>
                            <span className="text-zinc-500">
                              Est. Dist: <span className="text-zinc-300">{device.distance.toFixed(1)}m</span>
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

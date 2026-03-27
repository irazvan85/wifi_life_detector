import { CSISample, WiFiBoardInfo } from '../types';

/**
 * Lightweight protocol for CSI boards.
 *
 * The board sends newline-delimited JSON messages.  Two message types
 * are recognised:
 *
 *   CSI sample  – {"type":"csi","ts":12345,"amps":[1.02,0.98,...]}
 *   Board info  – {"type":"info","board":"ESP32","mac":"AA:BB:CC:DD:EE:FF",
 *                   "fw":"1.0","ch":6,"bw":"20 MHz","std":"802.11n",
 *                   "freq":"2.4 GHz","sc":30,"rate":20,"rssi":-45}
 *
 * If the board sends raw CSV instead of JSON (e.g. ESP-CSI toolkit),
 * the parser also accepts lines like:
 *   CSI_DATA,<rssi>,<subcarrier_count>,<amp0>,<amp1>,…
 */

export interface ParsedCSISample {
  kind: 'csi';
  sample: CSISample;
}

export interface ParsedBoardInfo {
  kind: 'info';
  info: WiFiBoardInfo;
}

export type ParsedMessage = ParsedCSISample | ParsedBoardInfo | null;

export function parseCSIMessage(line: string): ParsedMessage {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try JSON first
  if (trimmed.startsWith('{')) {
    return parseJSON(trimmed);
  }

  // Try CSV fallback (ESP-CSI toolkit format)
  if (trimmed.startsWith('CSI_DATA')) {
    return parseCSV(trimmed);
  }

  return null;
}

function parseJSON(raw: string): ParsedMessage {
  try {
    const msg = JSON.parse(raw);
    if (msg.type === 'csi' && Array.isArray(msg.amps)) {
      const amplitudes: number[] = msg.amps.map(Number);
      const meanAmplitude =
        amplitudes.reduce((a: number, b: number) => a + b, 0) / (amplitudes.length || 1);
      return {
        kind: 'csi',
        sample: {
          timestamp: typeof msg.ts === 'number' ? msg.ts : Date.now(),
          amplitudes,
          meanAmplitude,
        },
      };
    }

    if (msg.type === 'info') {
      return {
        kind: 'info',
        info: {
          boardModel: msg.board ?? 'Unknown',
          wifiStandard: msg.std ?? '802.11n',
          frequencyBand: msg.freq ?? '2.4 GHz',
          channel: msg.ch ?? 0,
          bandwidth: msg.bw ?? '20 MHz',
          macAddress: msg.mac ?? '00:00:00:00:00:00',
          firmwareVersion: msg.fw ?? 'unknown',
          subcarrierCount: msg.sc ?? 0,
          sampleRate: msg.rate ?? 0,
          rssi: msg.rssi ?? -100,
        },
      };
    }
  } catch {
    // Not valid JSON – ignore
  }
  return null;
}

function parseCSV(line: string): ParsedMessage {
  // CSI_DATA,<rssi>,<subcarrier_count>,<amp0>,<amp1>,…
  const parts = line.split(',');
  if (parts.length < 4) return null;

  const scCount = Number(parts[2]);
  const amplitudes: number[] = [];
  for (let i = 3; i < 3 + scCount && i < parts.length; i++) {
    amplitudes.push(Number(parts[i]) || 0);
  }

  if (amplitudes.length === 0) return null;

  const meanAmplitude =
    amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;

  return {
    kind: 'csi',
    sample: {
      timestamp: Date.now(),
      amplitudes,
      meanAmplitude,
    },
  };
}

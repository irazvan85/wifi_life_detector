import { HardwareAdapter } from './HardwareAdapter';
import { parseCSIMessage } from './csiProtocol';

/**
 * Type shim for the Web Serial API (not in lib.dom.d.ts by default).
 * The Web Serial API is available in Chrome/Edge on desktop (Windows,
 * macOS, Linux) and Chrome OS.  It is NOT available on mobile browsers.
 */
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface Serial {
  requestPort(options?: { filters?: Array<{ usbVendorId: number }> }): Promise<SerialPort>;
}

declare global {
  interface Navigator {
    serial?: Serial;
  }
}

/**
 * Connects to an ESP32 (or similar) board over Web Serial (USB).
 *
 * The board should stream newline-delimited JSON messages over its
 * USB-CDC serial interface as defined in `csiProtocol.ts`.
 *
 * Only works on **desktop** Chromium browsers (Chrome / Edge).  On
 * Android phones, use the WebSocket adapter instead.
 */
export class WebSerialAdapter extends HardwareAdapter {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private baudRate: number;
  private running = false;

  constructor(baudRate = 115200) {
    super();
    this.baudRate = baudRate;
  }

  setBaudRate(rate: number): void {
    this.baudRate = rate;
  }

  /** Returns true when the Web Serial API is available */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  async connect(): Promise<void> {
    if (!WebSerialAdapter.isSupported()) {
      this.setState('error');
      this.emitError('Web Serial API is not supported in this browser. Use Chrome or Edge on desktop.');
      throw new Error('Web Serial not supported');
    }

    if (this.state === 'connected' || this.state === 'connecting') return;

    this.setState('connecting');

    try {
      this.port = await navigator.serial!.requestPort();
      await this.port.open({ baudRate: this.baudRate });
      this.setState('connected');
      this.running = true;
      this.readLoop(); // fire and forget – runs until disconnect
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitError(msg);
      this.setState('error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.running = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        /* ignore */
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        /* port may already be closed */
      }
      this.port = null;
    }

    this.setState('disconnected');
  }

  /* ---- private ---- */

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return;

    const decoder = new TextDecoder();
    let lineBuffer = '';

    try {
      this.reader = this.port.readable.getReader();

      while (this.running) {
        const { value, done } = await this.reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const parsed = parseCSIMessage(line);
          if (!parsed) continue;
          if (parsed.kind === 'csi') {
            this.emitSample(parsed.sample);
          } else if (parsed.kind === 'info') {
            this.emitBoardInfo(parsed.info);
          }
        }
      }
    } catch (err) {
      if (this.running) {
        const msg = err instanceof Error ? err.message : String(err);
        this.emitError(`Serial read error: ${msg}`);
        this.setState('error');
      }
    } finally {
      this.reader = null;
    }
  }
}

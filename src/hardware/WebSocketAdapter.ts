import { HardwareAdapter } from './HardwareAdapter';
import { parseCSIMessage } from './csiProtocol';

/**
 * Connects to an ESP32 (or similar) board over WebSocket.
 *
 * The board should run a WebSocket server (e.g. on port 81) and stream
 * newline-delimited JSON messages as defined in `csiProtocol.ts`.
 *
 * Works on **both** Android phones and Windows PCs — any browser that
 * supports the standard WebSocket API.
 */
export class WebSocketAdapter extends HardwareAdapter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lineBuffer = '';

  constructor(url: string) {
    super();
    this.url = url;
  }

  setUrl(url: string): void {
    this.url = url;
  }

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') return;

    this.setState('connecting');

    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.setState('connected');
          this.lineBuffer = '';
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleData(typeof event.data === 'string' ? event.data : '');
        };

        this.ws.onerror = () => {
          const msg = `WebSocket error connecting to ${this.url}`;
          this.emitError(msg);
          if (this.state === 'connecting') {
            this.setState('error');
            reject(new Error(msg));
          }
        };

        this.ws.onclose = () => {
          if (this.state === 'connected') {
            this.setState('disconnected');
            this.scheduleReconnect();
          }
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.emitError(msg);
        this.setState('error');
        reject(err);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  /* ---- private ---- */

  private handleData(chunk: string): void {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split('\n');
    // Keep incomplete last line in buffer
    this.lineBuffer = lines.pop() ?? '';

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

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        /* reconnect silently */
      });
    }, 3000);
  }
}

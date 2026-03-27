import { CSISample, WiFiBoardInfo, ConnectionState } from '../types';

/**
 * Abstract base class for hardware CSI adapters.
 *
 * Subclasses implement connect/disconnect for a specific transport
 * (WebSocket, Web Serial, etc.) and call `emitSample` whenever a new
 * CSI frame arrives from the board.
 */
export abstract class HardwareAdapter {
  protected state: ConnectionState = 'disconnected';
  private sampleListeners: Array<(sample: CSISample) => void> = [];
  private boardInfoListeners: Array<(info: WiFiBoardInfo) => void> = [];
  private errorListeners: Array<(error: string) => void> = [];
  private stateListeners: Array<(state: ConnectionState) => void> = [];

  /* ---- public API ---- */

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  getState(): ConnectionState {
    return this.state;
  }

  onSample(cb: (sample: CSISample) => void): () => void {
    this.sampleListeners.push(cb);
    return () => {
      this.sampleListeners = this.sampleListeners.filter((l) => l !== cb);
    };
  }

  onBoardInfo(cb: (info: WiFiBoardInfo) => void): () => void {
    this.boardInfoListeners.push(cb);
    return () => {
      this.boardInfoListeners = this.boardInfoListeners.filter((l) => l !== cb);
    };
  }

  onError(cb: (error: string) => void): () => void {
    this.errorListeners.push(cb);
    return () => {
      this.errorListeners = this.errorListeners.filter((l) => l !== cb);
    };
  }

  onStateChange(cb: (state: ConnectionState) => void): () => void {
    this.stateListeners.push(cb);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== cb);
    };
  }

  /* ---- protected helpers for subclasses ---- */

  protected setState(s: ConnectionState): void {
    this.state = s;
    for (const cb of this.stateListeners) cb(s);
  }

  protected emitSample(sample: CSISample): void {
    for (const cb of this.sampleListeners) cb(sample);
  }

  protected emitBoardInfo(info: WiFiBoardInfo): void {
    for (const cb of this.boardInfoListeners) cb(info);
  }

  protected emitError(msg: string): void {
    for (const cb of this.errorListeners) cb(msg);
  }
}

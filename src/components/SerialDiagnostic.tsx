import React, { useState, useRef } from 'react';
import { Play, Square, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TestLine {
  type: 'info' | 'data' | 'error';
  text: string;
}

/**
 * Renders a quick serial-port read test.
 * Calls navigator.serial.requestPort() (user picks the port in the browser
 * dialog), opens at the given baud rate, collects up to MAX_LINES lines, then
 * closes the port automatically.
 */
export function SerialDiagnostic({ baudRate }: { baudRate: number }) {
  const MAX_LINES = 20;
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<TestLine[]>([]);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const portRef = useRef<{ close(): Promise<void> } | null>(null);

  const append = (type: TestLine['type'], text: string) =>
    setLines(prev => [...prev.slice(-(MAX_LINES * 3)), { type, text }]);

  const runTest = async () => {
    setLines([]);
    setRunning(true);
    try {
      append('info', `Requesting serial port — select COM5 (or your board) in the browser dialog…`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const port = await (navigator as any).serial.requestPort();
      portRef.current = port;
      await port.open({ baudRate });
      append('info', `Port opened at ${baudRate.toLocaleString()} baud. Waiting for data…`);

      const decoder = new TextDecoder();
      const reader = (port.readable as ReadableStream<Uint8Array>).getReader();
      readerRef.current = reader;

      let lineBuffer = '';
      let lineCount = 0;

      while (lineCount < MAX_LINES) {
        const { value, done } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const chunks = lineBuffer.split('\n');
        lineBuffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const trimmed = chunk.trim();
          if (trimmed) {
            append('data', trimmed);
            lineCount++;
            if (lineCount >= MAX_LINES) break;
          }
        }
      }

      append('info', `Done — received ${lineCount} line(s).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('cancelled') && !msg.includes('canceled') && !msg.includes('aborted')) {
        append('error', msg);
      } else {
        append('info', 'Test stopped.');
      }
    } finally {
      try { await readerRef.current?.cancel(); } catch { /* ignore */ }
      try { await portRef.current?.close(); } catch { /* ignore */ }
      readerRef.current = null;
      portRef.current = null;
      setRunning(false);
    }
  };

  const stopTest = async () => {
    try { await readerRef.current?.cancel(); } catch { /* ignore */ }
  };

  const hasData = lines.some(l => l.type === 'data');

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={running ? stopTest : runTest}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-[11px] uppercase tracking-wider transition-colors ${
            running
              ? 'bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20'
              : 'bg-purple-500/10 border-purple-500/50 text-purple-400 hover:bg-purple-500/20'
          }`}
        >
          {running ? (
            <><Square className="w-3 h-3" /> Stop</>
          ) : (
            <><Play className="w-3 h-3" /> Test Serial ({MAX_LINES} lines)</>
          )}
        </button>
        <span className="font-mono text-[10px] text-zinc-600">
          Opens browser port picker — select <strong className="text-zinc-400">COM5</strong>
        </span>
        {hasData && !running && (
          <span className="flex items-center gap-1 font-mono text-[10px] text-green-400">
            <CheckCircle2 className="w-3 h-3" /> Board data received
          </span>
        )}
      </div>

      {lines.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded p-2 font-mono text-[10px] max-h-44 overflow-y-auto">
          {lines.map((l, i) => (
            <div
              key={i}
              className={
                l.type === 'error'
                  ? 'text-red-400 flex items-start gap-1'
                  : l.type === 'info'
                  ? 'text-zinc-500'
                  : 'text-green-300'
              }
            >
              {l.type === 'error' && <AlertCircle className="w-3 h-3 shrink-0 mt-px" />}
              {l.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

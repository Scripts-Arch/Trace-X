'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[tracex] render error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-tracex-bg p-6" role="alert">
      <div className="tactical-frame w-full max-w-md rounded-lg border border-rose-500/40 bg-tracex-panel p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 text-rose-500" aria-hidden />
          <h1 className="font-mono text-sm font-bold tracking-[0.18em] text-slate-100">
            TRACE-X // SYSTEM FAULT
          </h1>
        </div>
        <p className="mb-4 font-mono text-[11px] leading-relaxed text-slate-400">
          The fusion dashboard encountered an unexpected error and had to halt rendering. The case
          data on disk is untouched — no evidence records were affected.
        </p>
        <p className="mb-5 break-all rounded border border-slate-700 bg-tracex-bg p-2 font-mono text-[9px] text-slate-500">
          {error.message || 'Unknown error'}
          {error.digest ? ` · digest ${error.digest.slice(0, 12)}` : ''}
        </p>
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-md border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 font-mono text-[10px] font-bold tracking-[0.14em] text-cyan-400 transition-colors hover:bg-cyan-500/20"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          RE-INITIALISE DASHBOARD
        </button>
      </div>
    </div>
  );
}

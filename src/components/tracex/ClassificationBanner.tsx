'use client';

import { AlertTriangle } from 'lucide-react';

export function ClassificationBanner() {
  return (
    <div
      role="note"
      aria-label="Classification banner"
      className="h-7 shrink-0 flex items-center justify-center gap-2 bg-red-950/60 border-b border-red-900/60 text-red-300/90 font-mono text-[9px] sm:text-[10px] tracking-[0.18em] select-none px-2"
    >
      <AlertTriangle className="h-3 w-3 text-red-400 tracex-blink" aria-hidden />
      <span className="truncate">
        RESTRICTED // CRIMINAL INTELLIGENCE — LAW ENFORCEMENT USE ONLY // BSA 2023 §63 COMPLIANT
      </span>
    </div>
  );
}

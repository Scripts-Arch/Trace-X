'use client';

import { useEffect, useState } from 'react';
import { Activity, Database, Radio } from 'lucide-react';
import { useTraceXStore } from '@/store/tracex-store';

export function StatusBar() {
  const nodes = useTraceXStore((s) => s.nodes);
  const edges = useTraceXStore((s) => s.edges);
  const caseMeta = useTraceXStore((s) => s.caseMeta);
  const [clock, setClock] = useState('--:--:--');

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="h-7 shrink-0 flex items-center justify-between gap-3 border-t border-slate-800/80 bg-tracex-status px-3 font-mono text-[9px] tracking-wider text-slate-500 select-none">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex items-center gap-1.5 text-cyan-400/90">
          <Radio className="h-2.5 w-2.5" aria-hidden />
          TRACE-X v2.4.1
        </span>
        <span className="hidden sm:inline text-slate-600">|</span>
        <span className="hidden sm:flex items-center gap-1.5">
          <Activity className="h-2.5 w-2.5 text-emerald-400" aria-hidden />
          GRAPH ENGINE ONLINE
        </span>
        <span className="hidden md:inline text-slate-600">|</span>
        <span className="hidden md:flex items-center gap-1.5">
          <Database className="h-2.5 w-2.5 text-violet-400" aria-hidden />
          {caseMeta ? caseMeta.codename : 'NO CASE'}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden sm:inline">
          ENTITIES {nodes.length} · LINKS {edges.length}
        </span>
        <span className="text-slate-400">UTC {clock}</span>
      </div>
    </footer>
  );
}

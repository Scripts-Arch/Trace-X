'use client';

import { useEffect, useState } from 'react';
import { Crosshair, FileDown, Loader2, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTraceXStore } from '@/store/tracex-store';

export function TopBar() {
  const cases = useTraceXStore((s) => s.cases);
  const caseMeta = useTraceXStore((s) => s.caseMeta);
  const openCase = useTraceXStore((s) => s.openCase);
  const [exporting, setExporting] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleExport = async () => {
    if (!caseMeta || exporting) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/export?caseId=${caseMeta.id}`);
      if (!res.ok) throw new Error('Export failed');
      const seal = res.headers.get('X-TraceX-Seal') ?? '';
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TRACE-X_${caseMeta.codename.replace(/\s+/g, '-')}_BSA63_Report.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('BSA 2023 §63 report exported', {
        description: `Integrity seal ${seal.slice(0, 24)}… — verify before court production.`,
      });
    } catch {
      toast.error('Report export failed', { description: 'The legal report service did not respond.' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="h-14 shrink-0 flex items-center gap-2 sm:gap-4 border-b border-slate-800/80 bg-tracex-panel px-3 sm:px-4">
      {/* system identity */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative h-8 w-8 shrink-0 flex items-center justify-center border border-cyan-500/50 bg-cyan-500/10 tactical-frame">
          <Crosshair className="h-4 w-4 text-cyan-400" aria-hidden />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="font-mono font-bold text-[15px] tracking-[0.22em] text-slate-100">
            TRACE<span className="text-cyan-400">-X</span>
          </div>
          <div className="hidden md:block font-mono text-[8.5px] tracking-[0.14em] text-slate-500 truncate">
            {'// CRIMINAL INTELLIGENCE FUSION DASHBOARD'}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      {/* agency badge */}
      <div
        className="hidden sm:flex items-center gap-2 h-8 px-2.5 border border-slate-700/70 bg-slate-800/40 rounded-md"
        title="Agency accreditation"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
        <div className="leading-none font-mono">
          <div className="text-[9px] tracking-[0.14em] text-slate-300">SOC · CRIME BRANCH</div>
          <div className="mt-0.5 flex items-center gap-1 text-[8px] tracking-[0.14em] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 tracex-pulse" aria-hidden />
            OPERATIONAL
          </div>
        </div>
      </div>

      {/* active case selector */}
      <div className="flex items-center gap-2">
        <span className="hidden lg:block font-mono text-[9px] tracking-[0.18em] text-slate-500">ACTIVE CASE</span>
        <Select value={caseMeta?.id ?? ''} onValueChange={(v) => openCase(v)} aria-label="Active case selector">
          <SelectTrigger className="h-9 w-[168px] sm:w-[210px] border-slate-700 bg-slate-900/60 font-mono text-[11px] tracking-wide text-slate-200 focus:ring-cyan-500/40">
            <SelectValue placeholder="SELECT CASE" />
          </SelectTrigger>
          <SelectContent className="border-slate-700 bg-tracex-panel font-mono">
            {cases.map((c) => (
              <SelectItem
                key={c.id}
                value={c.id}
                className="font-mono text-[11px] focus:bg-slate-800 focus:text-cyan-300"
              >
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 tracex-pulse" aria-hidden />
                  {c.codename}
                  <span className="text-slate-500">
                    {c.nodeCount}N/{c.edgeCount}E
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* light / dark theme toggle */}
      <Button
        onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
        variant="outline"
        className="h-9 w-9 shrink-0 p-0 border-slate-700 bg-slate-900/60 hover:bg-slate-800 hover:text-slate-200 focus:ring-cyan-500/40"
        aria-label={mounted && resolvedTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        title="Toggle light / dark theme"
      >
        {mounted && resolvedTheme === 'light' ? (
          <Moon className="h-4 w-4 text-slate-300" aria-hidden />
        ) : (
          <Sun className="h-4 w-4 text-cyan-400" aria-hidden />
        )}
      </Button>

      {/* BSA 2023 export */}
      <Button
        onClick={handleExport}
        disabled={exporting || !caseMeta}
        className="h-9 gap-2 border border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-mono text-[10px] tracking-[0.12em] hover:bg-cyan-500/20 hover:text-cyan-200 focus:ring-cyan-500/40"
        aria-label="Export BSA 2023 legal report"
      >
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileDown className="h-3.5 w-3.5" aria-hidden />}
        <span className="hidden sm:inline">EXPORT BSA 2023 LEGAL REPORT</span>
        <span className="sm:hidden">BSA §63</span>
      </Button>
    </header>
  );
}

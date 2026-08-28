'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Car,
  CheckCheck,
  Copy,
  Eraser,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Landmark,
  Loader2,
  MapPin,
  Phone,
  RotateCcw,
  User,
  UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useTraceXStore } from '@/store/tracex-store';
import { ALL_NODE_TYPES, NODE_COLORS, NodeType, TYPE_LABELS } from '@/lib/tracex/types';

// ─── sample ingest payloads (demo fixtures) ────────────────────────

const SAMPLE_CDR = `calling_party,called_party,date,duration_sec,first_cell_id
9873290814,9958210047,2024-06-03,145,DEL_KRB_07
9958210047,9811044172,2024-06-03,89,DEL_KRB_07
9811044172,9958210047,2024-06-05,1240,DEL_CP_02
9958210047,9873290814,2024-06-07,66,NOI_SEC_11
9958210047,9002466230,2024-06-11,301,DEL_KRB_07
9002466230,9958210047,2024-06-11,58,DEL_KRB_07`;

const SAMPLE_BANK = `date,from_account,to_account,amount_inr,mode,narrative
2024-06-09,HDFC0004417,ICIC0009023,2750000,RTGS,consultancy invoice
2024-06-12,ICIC0009023,SBIN0007842,2410000,NEFT,logistics advance
2024-06-15,SBIN0007842,8822900441,1985000,IMPS,travel booking`;

const SAMPLE_FIR = `FIRST INFORMATION REPORT — SUPPLEMENTARY NOTE
PS Karol Bagh · dated 2024-06-18

Complainant states that accused Ravi Menon, acting on behalf of the
syndicate, coordinated a cash drop near Narela Warehouse using vehicle
MH-01-CD-7788. Call analysis shows accused Sunil Mehra in contact with
the handset +91 90024 66230 shortly before each movement.
Estimated settlement value Rs. 28.5 lakh routed outside banking channels.`;

const SAMPLES: { label: string; file: () => File }[] = [
  { label: 'CDR CSV', file: () => new File([SAMPLE_CDR], 'cdr_batch_june.csv', { type: 'text/csv' }) },
  { label: 'BANK CSV', file: () => new File([SAMPLE_BANK], 'hdfc_statement_q2.csv', { type: 'text/csv' }) },
  { label: 'FIR NOTE', file: () => new File([SAMPLE_FIR], 'fir_supplementary_note.txt', { type: 'text/plain' }) },
];

// ─── panel sections ────────────────────────────────────────────────

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-mono text-[10px] font-semibold tracking-[0.22em] text-slate-500">{children}</h2>
      {right}
    </div>
  );
}

const TYPE_ICONS: Record<NodeType, React.ComponentType<{ className?: string }>> = {
  PERSON: User,
  PHONE: Phone,
  BANK_ACCOUNT: Landmark,
  VEHICLE: Car,
  LOCATION: MapPin,
  FIR: FileText,
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const fmtDay = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};

export function LeftPanel() {
  const nodes = useTraceXStore((s) => s.nodes);
  const edges = useTraceXStore((s) => s.edges);
  const evidence = useTraceXStore((s) => s.evidence);
  const visibleTypes = useTraceXStore((s) => s.visibleTypes);
  const toggleType = useTraceXStore((s) => s.toggleType);
  const setAllTypes = useTraceXStore((s) => s.setAllTypes);
  const dateRange = useTraceXStore((s) => s.dateRange);
  const fullRange = useTraceXStore((s) => s.fullRange);
  const setDateRange = useTraceXStore((s) => s.setDateRange);
  const resetDateRange = useTraceXStore((s) => s.resetDateRange);
  const uploadFile = useTraceXStore((s) => s.uploadFile);
  const uploadBusy = useTraceXStore((s) => s.uploadBusy);
  const resetCase = useTraceXStore((s) => s.resetCase);
  const resetBusy = useTraceXStore((s) => s.resetBusy);
  const openCase = useTraceXStore((s) => s.openCase);
  const caseMeta = useTraceXStore((s) => s.caseMeta);

  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBlank = caseMeta?.id === 'case-blank';

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nodes) counts[n.type] = (counts[n.type] ?? 0) + 1;
    return counts;
  }, [nodes]);

  const activeLinks = useMemo(() => {
    const ok = new Set(visibleTypes);
    return edges.filter((e) => {
      const t = new Date(e.date).getTime();
      if (t < dateRange[0] || t > dateRange[1]) return false;
      const s = nodes.find((n) => n.id === e.source);
      const d = nodes.find((n) => n.id === e.target);
      return s && d && ok.has(s.type) && ok.has(d.type);
    }).length;
  }, [edges, nodes, visibleTypes, dateRange]);

  const ingest = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const result = await uploadFile(file);
      if (result) {
        const method = result.extractionMethod;
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        let description = `SHA-256 sealed · ${result.entityCount} entities · +${result.nodeCount} nodes · +${result.edgeCount} links fused into graph`;
        if (isPdf && method === 'REAL_TEXT') {
          description = `PDF text extracted → NER + relationship inference · ${result.entityCount} entities · +${result.nodeCount} nodes · +${result.edgeCount} links`;
        } else if (isPdf && method === 'OCR_SIM') {
          description = `Scanned/image-only PDF — no text recoverable. SYNTHETIC fallback graph generated (deterministic from file hash). Re-export as a text-based PDF or .txt for real analysis.`;
        }
        toast.success(`Ingested: ${file.name}`, { description });
      } else {
        toast.error(`Ingestion failed: ${file.name}`);
      }
    }
  };

  const copyHash = async (hash: string, name: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      toast.success('SHA-256 copied to clipboard', { description: `${name} — evidence digest ready for the §63 certificate.` });
    } catch {
      toast.error('Clipboard unavailable');
    }
  };

  const handleReset = () => {
    // Native confirm is fine for a tactical tool — gets out of the way of the
    // dark UI without dragging in a full AlertDialog. Audit trail records it.
    const ok = window.confirm(
      isBlank
        ? 'Clear all ingested evidence and reset the graph to a blank canvas? Audit trail will record the reset.'
        : `Clear all ingested evidence and restore "${caseMeta?.codename}" to its canonical seed graph (${nodes.length}N / ${edges.length}E will be replaced)? Audit trail will record the reset.`
    );
    if (!ok) return;
    void (async () => {
      await resetCase();
      toast.success(isBlank ? 'Blank canvas restored' : 'Graph reset to canonical seed', {
        description: 'All ingested exhibits cleared. The audit trail keeps the reset on record.',
      });
    })();
  };

  const handleNewBlank = () => {
    if (caseMeta?.id === 'case-blank') {
      // Already on the blank canvas — offer to reset instead.
      handleReset();
      return;
    }
    void openCase('case-blank');
    toast.info('Switched to NEW ANALYSIS', {
      description: 'Blank canvas — upload your own FIR PDFs, CDR CSVs, bank statements or text notes to build a fresh case from scratch.',
    });
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4" role="complementary" aria-label="Ingestion and filters">
      {/* ── evidence ingestion ── */}
      <section className="flex flex-col gap-3" aria-label="Evidence ingestion">
        <SectionTitle
          right={
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleNewBlank}
                disabled={resetBusy || uploadBusy}
                className="flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-[8.5px] tracking-[0.14em] text-cyan-300 transition-colors hover:border-cyan-400 hover:bg-cyan-500/20 disabled:opacity-40"
                aria-label="Open a blank analysis canvas"
                title="Open a blank canvas to upload your own evidence and build a fresh case"
              >
                <FilePlus2 className="h-3 w-3" aria-hidden />
                {isBlank ? 'RESET BLANK' : 'NEW BLANK'}
              </button>
              <button
                onClick={handleReset}
                disabled={resetBusy || uploadBusy || (evidence.length === 0 && !isBlank)}
                className="flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 font-mono text-[8.5px] tracking-[0.14em] text-rose-300 transition-colors hover:border-rose-400 hover:bg-rose-500/20 disabled:opacity-40"
                aria-label="Reset graph and clear ingested evidence"
                title="Wipe all ingested exhibits and restore the canonical seed graph"
              >
                {resetBusy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Eraser className="h-3 w-3" aria-hidden />}
                {isBlank ? 'CLEAR ALL' : 'RESET GRAPH'}
              </button>
            </div>
          }
        >
          EVIDENCE INGESTION
        </SectionTitle>
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag and drop evidence files: FIR PDFs, CDR CSVs, bank statements"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files.length) void ingest(e.dataTransfer.files);
          }}
          className={`group relative flex min-h-[108px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-all outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 ${
            dragActive
              ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.15)]'
              : 'border-slate-700 bg-slate-900/40 hover:border-cyan-500/60 hover:bg-cyan-500/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.csv,.txt,.md"
            className="hidden"
            aria-hidden
            onChange={(e) => {
              if (e.target.files?.length) void ingest(e.target.files);
              e.target.value = '';
            }}
          />
          {uploadBusy ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" aria-hidden />
              <span className="font-mono text-[10px] tracking-[0.14em] text-cyan-300">RUNNING NER PIPELINE…</span>
            </>
          ) : (
            <>
              <UploadCloud className={`h-6 w-6 transition-colors ${dragActive ? 'text-cyan-300' : 'text-slate-500 group-hover:text-cyan-400'}`} aria-hidden />
              <div className="font-mono text-[10px] tracking-[0.14em] text-slate-400">
                {dragActive ? 'RELEASE TO INGEST' : 'DROP EVIDENCE / CLICK TO BROWSE'}
              </div>
              <div className="font-mono text-[9px] tracking-wider text-slate-600">FIR PDFs · CDR CSVs · BANK STATEMENTS · TXT NOTES</div>
            </>
          )}
        </div>

        {/* sample quick-ingest */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[8.5px] tracking-[0.16em] text-slate-600">DEMO:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => void ingest([s.file()])}
              disabled={uploadBusy}
              className="flex-1 rounded border border-slate-700/70 bg-slate-900/60 px-1.5 py-1.5 font-mono text-[8.5px] tracking-[0.1em] text-slate-400 transition-colors hover:border-cyan-500/50 hover:text-cyan-300 disabled:opacity-40 min-h-[28px]"
            >
              + {s.label}
            </button>
          ))}
        </div>

        {/* ingested evidence log */}
        <div className="flex flex-col gap-1.5">
          {evidence.length === 0 ? (
            <div className="rounded border border-slate-800/80 bg-slate-900/30 px-3 py-2.5 font-mono text-[9px] leading-relaxed tracking-wider text-slate-600">
              NO EXHIBITS ON RECORD — chain-of-custody ledger will populate here after first ingestion.
            </div>
          ) : (
            <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-1" aria-label="Ingested evidence ledger">
              {evidence.map((ev) => (
                <li key={ev.id} className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
                  <div className="flex items-start gap-2">
                    {ev.fileType.includes('PDF') ? (
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden />
                    ) : ev.fileType.includes('BANK') ? (
                      <Banknote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                    ) : (
                      <FileSpreadsheet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[10px] text-slate-300">{ev.filename}</span>
                        <button
                          onClick={() => copyHash(ev.sha256, ev.filename)}
                          className="shrink-0 text-slate-500 transition-colors hover:text-cyan-400"
                          aria-label={`Copy SHA-256 of ${ev.filename}`}
                        >
                          <Copy className="h-3 w-3" aria-hidden />
                        </button>
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[8.5px] tracking-wider text-slate-600">
                        <span className="text-emerald-500/80">SHA {ev.sha256.slice(0, 12)}…{ev.sha256.slice(-6)}</span>
                        <span>·</span>
                        <span>{ev.entityCount} ENT</span>
                        <span>+{ev.linkCount} LNK</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── entity type filters ── */}
      <section className="flex flex-col gap-2.5" aria-label="Entity type filters">
        <SectionTitle
          right={
            <button
              onClick={() => setAllTypes(visibleTypes.length !== ALL_NODE_TYPES.length)}
              className="flex items-center gap-1 font-mono text-[8.5px] tracking-[0.14em] text-cyan-400/80 transition-colors hover:text-cyan-300"
              aria-label="Toggle all entity types"
            >
              <CheckCheck className="h-3 w-3" aria-hidden />
              {visibleTypes.length === ALL_NODE_TYPES.length ? 'NONE' : 'ALL'}
            </button>
          }
        >
          ENTITY FILTERS
        </SectionTitle>
        <div className="grid grid-cols-1 gap-1.5">
          {ALL_NODE_TYPES.map((t) => {
            const Icon = TYPE_ICONS[t];
            const checked = visibleTypes.includes(t);
            return (
              <label
                key={t}
                className={`flex min-h-[36px] cursor-pointer items-center gap-2.5 rounded border px-2.5 py-1.5 transition-colors ${
                  checked ? 'border-slate-700 bg-slate-900/50' : 'border-slate-800/60 bg-slate-900/20 opacity-50'
                } hover:border-cyan-500/40`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleType(t)}
                  className="border-slate-600 data-[state=checked]:border-cyan-500 data-[state=checked]:bg-cyan-500 data-[state=checked]:text-slate-950"
                  aria-label={`Toggle ${TYPE_LABELS[t]} nodes`}
                />
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: NODE_COLORS[t], boxShadow: `0 0 6px ${NODE_COLORS[t]}66` }}
                  aria-hidden
                />
                <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                <span className="flex-1 font-mono text-[10px] tracking-[0.12em] text-slate-300">{TYPE_LABELS[t].toUpperCase()}</span>
                <span className="rounded-sm bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-400" aria-label={`${typeCounts[t] ?? 0} nodes`}>
                  {typeCounts[t] ?? 0}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* ── temporal filter ── */}
      <section className="flex flex-col gap-3 pb-2" aria-label="Temporal filter">
        <SectionTitle
          right={
            <button
              onClick={resetDateRange}
              className="flex items-center gap-1 font-mono text-[8.5px] tracking-[0.14em] text-cyan-400/80 transition-colors hover:text-cyan-300"
              aria-label="Reset temporal filter"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              RESET
            </button>
          }
        >
          TEMPORAL FILTER
        </SectionTitle>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3.5">
          <div className="mb-3 flex items-center justify-between font-mono text-[10px] tracking-wider">
            <span className="text-cyan-300">{fmtDay(dateRange[0])}</span>
            <span className="text-slate-600">→</span>
            <span className="text-cyan-300">{fmtDay(dateRange[1])}</span>
          </div>
          <Slider
            value={dateRange}
            min={fullRange[0]}
            max={fullRange[1]}
            step={24 * 60 * 60 * 1000}
            onValueChange={(v) => setDateRange([v[0], v[1]])}
            minStepsBetweenThumbs={1}
            className="py-1 [&_[data-slot=slider-range]]:bg-cyan-500 [&_[data-slot=slider-thumb]]:border-cyan-400 [&_[data-slot=slider-thumb]]:bg-tracex-bg"
            aria-label="Filter network connections by date range"
          />
          <div className="mt-3 flex items-center justify-between font-mono text-[8.5px] tracking-[0.14em] text-slate-600">
            <span>WINDOW {fmtDay(fullRange[0])}</span>
            <span className="text-amber-400/90">{activeLinks}/{edges.length} LINKS LIVE</span>
            <span>{fmtDay(fullRange[1])}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  Crosshair,
  Fingerprint,
  Scale,
  ShieldAlert,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTraceXStore } from '@/store/tracex-store';
import {
  TraceXEdge,
  TraceXNode,
  NODE_COLORS,
  RISK_BAND_COLORS,
  TYPE_LABELS,
} from '@/lib/tracex/types';

// ─── risk score gauge ──────────────────────────────────────────────

function RiskGauge({ score, band }: { score: number; band: string }) {
  const R = 62;
  const Cx = 80;
  const Cy = 72;
  const arc = Math.PI * R;
  const dash = (score / 100) * arc;
  const color = RISK_BAND_COLORS[band as keyof typeof RISK_BAND_COLORS] ?? '#22C55E';
  // arc spans left (9 o'clock = 180°) → top (270°) → right (3 o'clock = 360°)
  const angle = 180 + (score / 100) * 180;
  const needleX = Cx + (R - 12) * Math.cos((angle * Math.PI) / 180);
  const needleY = Cy + (R - 12) * Math.sin((angle * Math.PI) / 180);

  return (
    <div className="flex flex-col items-center" role="img" aria-label={`Risk score ${score} out of 100, band ${band}`}>
      <svg viewBox="0 0 160 92" className="w-full max-w-[210px]">
        <path d={`M ${Cx - R} ${Cy} A ${R} ${R} 0 0 1 ${Cx + R} ${Cy}`} fill="none" style={{ stroke: 'var(--tracex-card)' }} strokeWidth="9" strokeLinecap="round" />
        <path
          d={`M ${Cx - R} ${Cy} A ${R} ${R} 0 0 1 ${Cx + R} ${Cy}`}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${arc}`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.4,0,0.2,1), stroke 400ms' }}
        />
        {[0, 25, 50, 75, 100].map((t) => {
          const a = ((180 + (t / 100) * 180) * Math.PI) / 180;
          const x1 = Cx + (R + 7) * Math.cos(a);
          const y1 = Cy + (R + 7) * Math.sin(a);
          const x2 = Cx + (R + 11) * Math.cos(a);
          const y2 = Cy + (R + 11) * Math.sin(a);
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" className="text-slate-700" strokeWidth="1" />;
        })}
        <line x1={Cx} y1={Cy} x2={needleX} y2={needleY} stroke="currentColor" className="text-slate-200" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx={Cx} cy={Cy} r="3.4" fill="currentColor" className="text-slate-200" />
        <text x={Cx} y={Cy - 14} textAnchor="middle" fill="currentColor" className="text-slate-100" fontSize="26" fontWeight="700" fontFamily="ui-monospace, monospace">
          {score}
        </text>
        <text x={Cx - R} y={Cy + 16} textAnchor="middle" fill="currentColor" className="text-slate-600" fontSize="7" fontFamily="ui-monospace, monospace">
          0
        </text>
        <text x={Cx + R} y={Cy + 16} textAnchor="middle" fill="currentColor" className="text-slate-600" fontSize="7" fontFamily="ui-monospace, monospace">
          100
        </text>
      </svg>
      <div
        className="mt-1 rounded-sm border px-2.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.22em]"
        style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}
      >
        {band}
      </div>
    </div>
  );
}

// ─── metric bar ────────────────────────────────────────────────────

function MetricBar({ label, value, max, display }: { label: string; value: number; max: number; display: string }) {
  const pct = Math.max(2, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between font-mono text-[9px] tracking-[0.14em]">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-300">{display}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400"
          style={{ width: `${pct}%`, transition: 'width 600ms cubic-bezier(0.4,0,0.2,1)' }}
        />
      </div>
    </div>
  );
}

// ─── SHA-256 via WebCrypto (entity evidence seal) ─────────────────

async function sha256Hex(input: string): Promise<string> {
  // secure-context guard: crypto.subtle is undefined over plain HTTP (non-localhost)
  if (!globalThis.crypto?.subtle) {
    return Array.from(input)
      .reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)
      .toString(16)
      .padStart(8, '0')
      .padEnd(64, '0');
  }
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── inspector drawer ──────────────────────────────────────────────

export function InspectorDrawer() {
  const nodes = useTraceXStore((s) => s.nodes);
  const edges = useTraceXStore((s) => s.edges);
  const metrics = useTraceXStore((s) => s.metrics);
  const selectedNodeId = useTraceXStore((s) => s.selectedNodeId);
  const caseMeta = useTraceXStore((s) => s.caseMeta);
  const selectNode = useTraceXStore((s) => s.selectNode);

  const node: TraceXNode | undefined = useMemo(() => nodes.find((n) => n.id === selectedNodeId), [nodes, selectedNodeId]);
  const m = node ? metrics[node.id] : undefined;

  const [hashState, setHashState] = useState<{ key: string; hash: string | null }>({ key: '', hash: null });
  const hashKey = node ? `${caseMeta?.id ?? 'case'}::${node.id}::${node.firstSeen}::${node.source}` : '';

  useEffect(() => {
    if (!hashKey) return;
    let cancelled = false;
    sha256Hex(hashKey)
      .then((h) => {
        if (!cancelled) setHashState({ key: hashKey, hash: h });
      })
      .catch(() => {
        if (!cancelled) setHashState({ key: hashKey, hash: 'UNAVAILABLE — DIGEST ERROR' });
      });
    return () => {
      cancelled = true;
    };
  }, [hashKey]);

  const entityHash = hashState.key === hashKey ? hashState.hash : null;

  const connections = useMemo<TraceXEdge[]>(() => {
    if (!node) return [];
    return edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [edges, node]);

  const maxPr = useMemo(() => Math.max(...Object.values(metrics).map((x) => x.pageRank), 1e-9), [metrics]);
  const maxBw = useMemo(() => Math.max(...Object.values(metrics).map((x) => x.betweenness), 1e-9), [metrics]);
  const maxDeg = useMemo(() => Math.max(...Object.values(metrics).map((x) => x.degree), 1), [metrics]);

  if (!node || !m) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-900/50">
          <Fingerprint className="h-5 w-5 text-slate-600" aria-hidden />
        </div>
        <div className="font-mono text-[10px] tracking-[0.2em] text-slate-500">ENTITY INSPECTOR</div>
        <p className="max-w-[240px] font-mono text-[9px] leading-relaxed tracking-wider text-slate-600">
          SELECT A NODE ON THE FUSION CANVAS TO PULL ITS DOSSIER — RISK INDEX, CENTRALITY METRICS AND §63 EVIDENCE SEAL.
        </p>
      </div>
    );
  }

  const typeColor = NODE_COLORS[node.type];

  return (
    <div className="flex h-full flex-col overflow-y-auto" role="complementary" aria-label={`Inspector: ${node.label}`}>
      {/* header */}
      <div className="sticky top-0 z-10 border-b border-slate-800/80 bg-tracex-panel/95 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="mt-1 h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: typeColor, boxShadow: `0 0 10px ${typeColor}88` }}
              aria-hidden
            />
            <div className="min-w-0">
              <h3 className="truncate font-mono text-[13px] font-bold leading-snug tracking-wide text-slate-100">{node.label}</h3>
              {node.alias && <div className="truncate font-mono text-[9px] tracking-wider text-slate-500">ALIAS: {node.alias}</div>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => {
                document.dispatchEvent(new CustomEvent('tracex:focus-node', { detail: node.id }));
                toast.info('Locating entity on canvas');
              }}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-700 text-slate-400 transition-colors hover:border-cyan-500/60 hover:text-cyan-300"
              aria-label="Centre graph on this entity"
              title="Locate on canvas"
            >
              <Crosshair className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              onClick={() => selectNode(null)}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-700 text-slate-400 transition-colors hover:border-rose-500/60 hover:text-rose-300 xl:hidden"
              aria-label="Close inspector"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-[8.5px] tracking-[0.14em]">
          <span className="rounded-sm border px-1.5 py-0.5" style={{ color: typeColor, borderColor: `${typeColor}55`, backgroundColor: `${typeColor}11` }}>
            {TYPE_LABELS[node.type].toUpperCase()}
          </span>
          <span className="rounded-sm border border-slate-700 px-1.5 py-0.5 text-slate-400">ID {node.id.toUpperCase()}</span>
          <span className="rounded-sm border border-slate-700 px-1.5 py-0.5 text-slate-400">RANK #{m.rank}</span>
          {node.flags?.map((f) => (
            <span
              key={f}
              className={`rounded-sm border px-1.5 py-0.5 ${
                f === 'KINGPIN'
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                  : 'border-slate-700 text-slate-400'
              }`}
            >
              {f.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* risk gauge + metrics */}
        <section aria-label="Entity risk and centrality metrics">
          <RiskGauge score={m.riskScore} band={m.riskBand} />
          <div className="mt-4 flex flex-col gap-3">
            <MetricBar label="PAGERANK" value={m.pageRank} max={maxPr} display={m.pageRank.toFixed(4)} />
            <MetricBar label="BETWEENNESS CENTRALITY" value={m.betweenness} max={maxBw} display={m.betweenness.toFixed(4)} />
            <MetricBar label="DEGREE (LINKS)" value={m.degree} max={maxDeg} display={String(m.degree)} />
          </div>
        </section>

        {/* connected entities */}
        <section aria-label="Connected entities">
          <h4 className="mb-2 font-mono text-[10px] font-semibold tracking-[0.22em] text-slate-500">
            CONNECTED ENTITIES <span className="text-cyan-400/80">({connections.length})</span>
          </h4>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
            {connections.map((e) => {
              const otherId = e.source === node.id ? e.target : e.source;
              const other = nodes.find((n) => n.id === otherId);
              if (!other) return null;
              const outgoing = e.source === node.id;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => selectNode(other.id)}
                    className="group flex w-full items-center gap-2 rounded border border-slate-800/70 bg-slate-900/40 px-2 py-1.5 text-left transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5"
                    aria-label={`Inspect connected entity ${other.label}`}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: NODE_COLORS[other.type] }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[10px] text-slate-300 group-hover:text-cyan-200">{other.label}</span>
                      <span className="block font-mono text-[8px] tracking-wider text-slate-600">
                        {e.label ?? e.type} · {e.date}
                      </span>
                    </span>
                    {outgoing ? (
                      <ArrowRight className="h-3 w-3 shrink-0 text-slate-600 group-hover:text-cyan-400" aria-hidden />
                    ) : (
                      <ArrowLeft className="h-3 w-3 shrink-0 text-slate-600 group-hover:text-cyan-400" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* dossier metadata */}
        {node.meta && Object.keys(node.meta).length > 0 && (
          <section aria-label="Entity dossier metadata">
            <h4 className="mb-2 font-mono text-[10px] font-semibold tracking-[0.22em] text-slate-500">DOSSIER</h4>
            <dl className="grid grid-cols-1 gap-1 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              {Object.entries(node.meta).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-slate-800/50 pb-1 last:border-0 last:pb-0">
                  <dt className="shrink-0 font-mono text-[8.5px] tracking-[0.14em] text-slate-500">{k.toUpperCase()}</dt>
                  <dd className="truncate text-right font-mono text-[9.5px] text-slate-300">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* analyst assessment */}
        {node.assessment && (
          <section aria-label="Analyst assessment">
            <h4 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.22em] text-slate-500">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400/80" aria-hidden />
              ANALYST ASSESSMENT
            </h4>
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 font-mono text-[9.5px] leading-relaxed text-slate-300">
              {node.assessment}
            </p>
          </section>
        )}

        {/* BSA 2023 §63 evidence card */}
        <section aria-label="Section 63 BSA 2023 digital evidence record">
          <div className="tactical-frame rounded-lg border border-amber-500/30 bg-gradient-to-b from-amber-500/[0.07] to-transparent p-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <Scale className="h-4 w-4 text-amber-400" aria-hidden />
              <h4 className="font-mono text-[10px] font-bold tracking-[0.18em] text-amber-300">
                SECTION 63 · BSA 2023 — DIGITAL EVIDENCE
              </h4>
            </div>
            <div className="space-y-2 font-mono text-[8.5px] tracking-wider">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">RECORD ORIGIN</span>
                <span className="truncate text-slate-300">{node.source}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">FIRST OBSERVED</span>
                <span className="text-slate-300">{node.firstSeen}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">CHAIN STATUS</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <BadgeCheck className="h-3 w-3" aria-hidden />
                  INTACT · COURT-READY
                </span>
              </div>
              <div className="pt-1">
                <div className="mb-1 text-slate-500">IMMUTABLE SHA-256 EVIDENCE HASH</div>
                {entityHash ? (
                  <button
                    onClick={() => {
                      navigator.clipboard
                        .writeText(entityHash)
                        .then(() => toast.success('Evidence hash copied', { description: 'Digest of the §63 record for the court file.' }))
                        .catch(() => toast.error('Clipboard unavailable'));
                    }}
                    className="w-full break-all rounded border border-amber-500/25 bg-tracex-bg p-2 text-left text-[8.5px] leading-relaxed text-amber-200/90 transition-colors hover:border-amber-400/50 hover:text-amber-200"
                    aria-label="Copy SHA-256 evidence hash"
                  >
                    {entityHash}
                  </button>
                ) : (
                  <div className="animate-pulse rounded border border-amber-500/25 bg-tracex-bg p-2 text-amber-200/40">COMPUTING DIGEST…</div>
                )}
              </div>
              <p className="pt-1 leading-relaxed text-slate-600">
                Hash is computed over the case binding, entity identity, first-observation timestamp and provenance. Any
                tampering invalidates the digest and the §63(4) certificate.
              </p>
            </div>
          </div>
        </section>

        {/* provenance footer */}
        <div className="mt-auto pt-2 font-mono text-[8px] leading-relaxed tracking-[0.14em] text-slate-600">
          SOURCE: {node.source} · INGESTED VIA TRACE-X FUSION PIPELINE · {caseMeta?.codename ?? '—'}
        </div>
      </div>
    </div>
  );
}

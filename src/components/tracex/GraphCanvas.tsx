'use client';

// TRACE-X // Central interactive canvas — Cytoscape.js force-graph

import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import {
  Crosshair,
  Loader2,
  Maximize2,
  Minus,
  Network,
  Plus,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { useTraceXStore } from '@/store/tracex-store';
import { NODE_COLORS, NODE_SHAPES, TraceXNode } from '@/lib/tracex/types';
import { detectCommunities } from '@/lib/tracex/centrality';

let fcoseRegistered = false;

// Silence Cytoscape's known-issue warning that fires whenever a bezier edge
// briefly has zero length (during fCoSE layout animation or when a spoke
// settles on top of its hub). Cytoscape itself flags this as "expected
// behaviour" — see https://github.com/cytoscape/cytoscape.js — but it logs
// in red and looks like a runtime error to the user. Filter it once, at
// module init, before any cytoscape instance is created.
if (typeof window !== 'undefined' && !(window as unknown as { __cytoscapeWarnFilterInstalled?: boolean }).__cytoscapeWarnFilterInstalled) {
  (window as unknown as { __cytoscapeWarnFilterInstalled?: boolean }).__cytoscapeWarnFilterInstalled = true;
  const origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const joined = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
    if (joined.includes('has invalid endpoints') && joined.includes('impossible to draw')) return;
    origWarn(...args);
  };
}

const CLUSTER_COLORS = ['#22D3EE', '#F43F5E', '#F59E0B', '#34D399', '#A78BFA', '#FB923C'];

function graphLabel(n: TraceXNode): string {
  if (n.type === 'PERSON') {
    const nick = n.label.match(/"([^"]+)"/)?.[1];
    if (nick) return `${nick} ${n.label.split(' ').slice(-1)[0]}`;
    return n.label;
  }
  return n.label;
}

// Full stylesheet, parameterised by theme. Dark values are byte-identical to the
// original tactical night-ops look; light values swap only the neutral chrome.
function cyStyle(light: boolean): cytoscape.StylesheetJsonBlock[] {
  const nodeChrome = light
    ? { 'border-color': '#ffffff', color: '#1e293b', 'text-outline-color': '#ffffff', 'text-background-color': '#ffffff' }
    : { 'border-color': '#0B0F19', color: '#E2E8F0', 'text-outline-color': '#0B0F19', 'text-background-color': '#0B0F19' };
  const edgeChrome = light
    ? {
        'line-color': '#94a3b8',
        'target-arrow-color': '#94a3b8',
        color: '#475569',
        'text-background-color': '#ffffff',
        'text-outline-color': '#ffffff',
      }
    : {
        'line-color': '#33415C',
        'target-arrow-color': '#33415C',
        color: '#5B6B85',
        'text-background-color': '#0B0F19',
        'text-outline-color': '#0B0F19',
      };
  return [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      'border-width': 2,
      'border-opacity': 0.95,
      // data-mapper string is valid cytoscape runtime syntax but not in the typings — typed mapper fn is equivalent
      shape: (n: cytoscape.NodeSingular) => n.data('shape') as cytoscape.Css.NodeShape,
      width: 'data(size)',
      height: 'data(size)',
      label: 'data(label)',
      'font-family': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      'font-size': 11,
      'font-weight': 600,
      ...nodeChrome,
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 9,
      'text-wrap': 'wrap',
      'text-max-width': '120px',
      // pill-style label background so labels stay legible over crossing edges
      'text-background-opacity': 0.82,
      'text-background-shape': 'round-rectangle',
      'text-background-padding': '3px',
      'text-border-width': 0.5,
      'text-border-color': light ? '#cbd5e1' : '#1e293b',
      'text-border-opacity': 0.8,
      'text-outline-width': 1,
      'min-zoomed-font-size': 8,
    },
  },
  // ── kingpin: amber glow ring + larger label ──
  {
    selector: 'node[kingpin = "true"]',
    style: {
      'border-color': '#F59E0B',
      'border-width': 4,
      'font-size': 12,
      color: light ? '#b45309' : '#FCD34D',
      'underlay-color': '#F59E0B',
      'underlay-opacity': 0.28,
      'underlay-padding': 8,
      'z-index': 50,
    },
  },
  {
    selector: 'node:selected',
    style: {
      'border-color': '#22D3EE',
      'border-width': 3,
      'underlay-color': '#22D3EE',
      'underlay-opacity': 0.25,
      'underlay-padding': 6,
    },
  },
  {
    selector: 'node.highlighted',
    style: {
      'border-color': '#22D3EE',
      'border-width': 4,
      'underlay-color': '#22D3EE',
      'underlay-opacity': 0.35,
      'underlay-padding': 9,
      color: light ? '#155e75' : '#A5F3FC',
      'z-index': 100,
    },
  },
  {
    selector: 'node.dimmed',
    style: { opacity: 0.1 },
  },
  // ── base edge: operational relationships get a clear default ──
  {
    selector: 'edge',
    style: {
      width: 'data(width)',
      ...edgeChrome,
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 0.85,
      label: 'data(label)',
      'font-family': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      'font-size': 8,
      'text-rotation': 'autorotate',
      'text-background-opacity': 0.88,
      'text-background-padding': '2px',
      'text-outline-width': 1.5,
      'min-zoomed-font-size': 9,
      'z-index': 10,
    },
  },
  // ── provenance / document-star edges: faint + thin + behind, so the
  //    entity↔entity operational network reads on top of them instead of
  //    being drowned out by the document hub hairball ──
  {
    selector: 'edge[type = "LINKED_TO"], edge[type = "NAMES_ACCUSED"]',
    style: {
      'line-color': light ? '#cbd5e1' : '#2A3550',
      'target-arrow-color': light ? '#cbd5e1' : '#2A3550',
      width: 0.8,
      'arrow-scale': 0.45,
      'line-opacity': 0.45,
      // straight (not bezier) so fCoSE can place a spoke on the FIR hub
      // without logging "edge has invalid endpoints" — bezier needs non-zero
      // edge length to compute its control points; straight just draws a
      // zero-length line silently when endpoints overlap.
      'curve-style': 'straight',
      label: '',
      'z-index': 0,
      'underlay-color': 'transparent',
    },
  },
  // ── OWNS (person→phone/account/vehicle): solid amber, modest ──
  {
    selector: 'edge[type = "OWNS"]',
    style: { 'line-color': '#D97706', 'target-arrow-color': '#D97706', width: 1.6, 'line-style': 'solid' },
  },
  // ── USES: dotted amber variant ──
  {
    selector: 'edge[type = "USES"]',
    style: { 'line-color': '#D97706', 'target-arrow-color': '#D97706', width: 1.3, 'line-style': 'dotted' },
  },
  // ── CALLED (phone→phone): dashed cyan ──
  {
    selector: 'edge[type = "CALLED"]',
    style: { 'line-color': '#0EA5E9', 'target-arrow-color': '#0EA5E9', 'line-style': 'dashed', width: 1.5 },
  },
  // ── TRANSFERRED_FUNDS (account→account): solid emerald, width ∝ amount ──
  {
    selector: 'edge[type = "TRANSFERRED_FUNDS"]',
    style: { 'line-color': '#10B981', 'target-arrow-color': '#10B981', width: 2.2 },
  },
  // ── CO_ACCUSED (person↔person): bold crimson, bidirectional ──
  {
    selector: 'edge[type = "CO_ACCUSED"]',
    style: { 'line-color': '#DC2626', 'target-arrow-color': '#DC2626', 'source-arrow-shape': 'triangle', 'source-arrow-color': '#DC2626', width: 2.8 },
  },
  // ── SPOTTED_AT (vehicle/person→location): dotted violet ──
  {
    selector: 'edge[type = "SPOTTED_AT"]',
    style: { 'line-color': '#A855F7', 'target-arrow-color': '#A855F7', 'line-style': 'dotted', width: 1.4 },
  },
  {
    selector: 'edge.highlighted',
    style: { 'line-color': '#22D3EE', 'target-arrow-color': '#22D3EE', width: 3, color: light ? '#155e75' : '#A5F3FC' },
  },
  {
    selector: 'edge.dimmed',
    style: { opacity: 0.05 },
  },
  ...CLUSTER_COLORS.map(
    (c, i): cytoscape.StylesheetJsonBlock => ({
      selector: `node.cluster-${i}`,
      style: { 'border-color': c, 'border-width': 3, 'border-opacity': 0.95 },
    })
  ),
  ];
}

function runLayout(cy: cytoscape.Core, randomize: boolean) {
  // fCoSE tuned for legibility on multi-relational criminal networks:
  //   - larger nodeSeparation + idealEdgeLength → nodes don't pile up
  //   - higher nodeRepulsion → pushes tangled clusters apart
  //   - lower gravity → components spread rather than collapse to centre
  //   - bigger componentSpacing → disconnected sub-clusters separate cleanly
  const layout = cy.layout({
    name: 'fcose',
    animate: true,
    animationDuration: 700,
    animationEasing: 'ease-in-out-cubic',
    randomize,
    nodeSeparation: 180,
    idealEdgeLength: 165,
    nodeRepulsion: 14000,
    edgeElasticity: 0.55,
    gravity: 0.18,
    gravityRangeCompound: 1.4,
    componentSpacing: 140,
    padding: 80,
    quality: 'default',
    // de-emphasise provenance edges in the layout physics so they don't
    // pull every entity onto the document hub (the hairball cause)
    edgeWeight: (e: cytoscape.EdgeSingular): number => {
      const t = e.data('type') as string;
      return t === 'LINKED_TO' || t === 'NAMES_ACCUSED' ? 0.25 : 1;
    },
  } as cytoscape.LayoutOptions);
  layout.run();
}

function ToolbarButton({
  label,
  title,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-md border shadow-lg backdrop-blur transition-all min-h-[40px] ${
        active
          ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-300'
          : 'border-slate-700/80 bg-tracex-panel/95 text-slate-400 hover:border-cyan-500/60 hover:text-cyan-300'
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

export function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const { resolvedTheme } = useTheme();
  const nodes = useTraceXStore((s) => s.nodes);
  const edges = useTraceXStore((s) => s.edges);
  const metrics = useTraceXStore((s) => s.metrics);
  const loading = useTraceXStore((s) => s.loading);
  const visibleTypes = useTraceXStore((s) => s.visibleTypes);
  const dateRange = useTraceXStore((s) => s.dateRange);
  const selectedNodeId = useTraceXStore((s) => s.selectedNodeId);
  const highlightNodeIds = useTraceXStore((s) => s.highlightNodeIds);
  const clusterMode = useTraceXStore((s) => s.clusterMode);
  const selectNode = useTraceXStore((s) => s.selectNode);
  const setHighlight = useTraceXStore((s) => s.setHighlight);
  const setLeftSheetOpen = useTraceXStore((s) => s.setLeftSheetOpen);

  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [layoutNonce, setLayoutNonce] = useState(0);

  const maxPr = useMemo(() => Math.max(...Object.values(metrics).map((m) => m.pageRank), 1e-9), [metrics]);

  // ── init / destroy ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    if (!fcoseRegistered) {
      try {
        cytoscape.use(fcose);
        fcoseRegistered = true;
      } catch {
        /* already registered */
      }
    }
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: cyStyle(false),
      wheelSensitivity: 0.22,
      minZoom: 0.25,
      maxZoom: 2.8,
      selectionType: 'single',
    });
    cy.on('tap', 'node', (evt) => {
      selectNode(evt.target.id());
    });
    cy.on('tap', (evt) => {
      if (evt.target === cy) selectNode(null);
    });
    cyRef.current = cy;
    // expose instance for console-level E2E debugging (dev only)
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __tracexCy?: cytoscape.Core }).__tracexCy = cy;
    }

    // inspector "locate" button → centre on entity
    const onFocusNode = (evt: Event) => {
      const id = (evt as CustomEvent<string>).detail;
      const el = cy.getElementById(id);
      if (el.nonempty()) cy.animate({ center: { eles: el }, zoom: 1.35 }, { duration: 380 });
    };
    document.addEventListener('tracex:focus-node', onFocusNode);

    return () => {
      document.removeEventListener('tracex:focus-node', onFocusNode);
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // ── theme reactivity (neutral graph chrome only — dark values mirror cyStyle(false)) ──
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.style(cyStyle(resolvedTheme === 'light')).update();
  }, [resolvedTheme]);

  // ── element sync (graph data changed) ─────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || loading) return;
    cy.resize();
    cy.elements().remove();
    const nodeEls = nodes.map((n) => {
      const m = metrics[n.id];
      const size = Math.round(26 + 42 * ((m?.pageRank ?? 0) / maxPr));
      return {
        group: 'nodes' as const,
        data: {
          id: n.id,
          label: graphLabel(n),
          color: NODE_COLORS[n.type],
          shape: NODE_SHAPES[n.type],
          size: Math.max(26, Math.min(64, size)),
          type: n.type,
          kingpin: n.flags?.includes('KINGPIN') ? 'true' : 'false',
          risk: m?.riskScore ?? 0,
        },
      };
    });
    const edgeEls = edges.map((e) => {
      let width = 1.4;
      if (e.type === 'TRANSFERRED_FUNDS') width = 1.5 + Math.min(2.5, (e.weight ?? 0) / 2000000);
      else if (e.type === 'CALLED') width = 1.2 + Math.min(2.2, (e.weight ?? 1) / 22);
      else if (e.type === 'CO_ACCUSED') width = 2.5;
      return {
        group: 'edges' as const,
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
          label: e.label ?? e.type,
          width,
          ts: new Date(e.date).getTime(),
        },
      };
    });
    cy.add([...nodeEls, ...edgeEls]);
    runLayout(cy, true);
    setTimeout(() => cy.fit(undefined, 70), 720);
  }, [nodes, edges, layoutNonce]);

  // ── type + temporal filters ───────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || loading) return;
    const ok = new Set(visibleTypes);
    const visibleEdges = cy.edges().filter((e) => {
      const ts = e.data('ts') as number;
      if (ts < dateRange[0] || ts > dateRange[1]) return false;
      return ok.has(e.source().data('type')) && ok.has(e.target().data('type'));
    });
    const activeIds = new Set<string>();
    visibleEdges.forEach((e) => {
      activeIds.add(e.source().id());
      activeIds.add(e.target().id());
    });
    const visibleNodes = cy.nodes().filter((n) => ok.has(n.data('type')) && activeIds.has(n.id()));
    cy.batch(() => {
      cy.edges().difference(visibleEdges).style('display', 'none');
      visibleEdges.removeStyle('display');
      cy.nodes().difference(visibleNodes).style('display', 'none');
      visibleNodes.removeStyle('display');
    });
    setStats({ nodes: visibleNodes.length, edges: visibleEdges.length });
  }, [visibleTypes, dateRange, nodes, edges, loading, layoutNonce]);

  // ── copilot highlight ─────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || loading) return;
    cy.batch(() => {
      cy.elements().removeClass('highlighted dimmed');
      if (highlightNodeIds && highlightNodeIds.length) {
        const match = cy.collection();
        const idSet = new Set(highlightNodeIds);
        cy.nodes().forEach((n) => {
          if (idSet.has(n.id())) match.merge(n);
        });
        // include edges fully inside the highlighted set
        cy.edges().forEach((e) => {
          if (idSet.has(e.source().id()) && idSet.has(e.target().id())) match.merge(e);
        });
        if (match.length) {
          cy.elements().not(match).addClass('dimmed');
          match.addClass('highlighted');
          match.removeStyle('display');
          cy.fit(match, 110);
        }
      }
    });
  }, [highlightNodeIds, loading, nodes, edges]);

  // ── selection ─────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || loading) return;
    cy.elements().unselect();
    if (selectedNodeId) {
      const el = cy.getElementById(selectedNodeId);
      if (el.nonempty()) el.select();
    }
  }, [selectedNodeId, loading, nodes, edges]);

  // ── community clustering ──────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || loading) return;
    cy.batch(() => {
      cy.nodes().removeClass(CLUSTER_COLORS.map((_, i) => `cluster-${i}`));
      if (clusterMode) {
        const communities = detectCommunities(nodes, edges);
        communities.forEach((label, id) => {
          cy.getElementById(id).addClass(`cluster-${label % CLUSTER_COLORS.length}`);
        });
      }
    });
  }, [clusterMode, nodes, edges, loading]);

  const zoom = (factor: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({ level: cy.zoom() * factor, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };

  const refit = () => cyRef.current?.fit(undefined, 70);

  const relayout = () => {
    if (cyRef.current) {
      runLayout(cyRef.current, true);
      toast.info('Physics layout recomputed', { description: 'fCoSE force-directed relaxation with node clustering.' });
    }
  };

  const toggleCluster = () => {
    const next = !clusterMode;
    useTraceXStore.getState().setClusterMode(next);
    if (next) {
      const communities = detectCommunities(nodes, edges);
      const count = new Set(communities.values()).size;
      toast.success(`Community detection: ${count} cluster${count === 1 ? '' : 's'}`, {
        description: 'Label-propagation partition — node halos now colour-code detected compartments.',
      });
    }
  };

  const focusSelected = () => {
    const cy = cyRef.current;
    if (!cy || !selectedNodeId) return;
    const el = cy.getElementById(selectedNodeId);
    if (el.nonempty()) {
      cy.animate({ center: { eles: el }, zoom: 1.35 }, { duration: 380 });
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-tracex-bg">
      {/* dotted tactical grid + scanline */}
      <div className="tracex-grid absolute inset-0" aria-hidden />
      <div className="tracex-scanline" aria-hidden />

      {/* cytoscape mount — wrapper handles positioning; cytoscape forces
          position:relative on its own container via an unlayered global rule,
          so it must simply fill the wrapper instead of being absolute */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="cy-container h-full w-full" role="application" aria-label="Criminal network graph canvas" />
      </div>

      {/* loading veil */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-tracex-bg/85 backdrop-blur-[2px]">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-400" aria-hidden />
          <span className="font-mono text-[10px] tracking-[0.28em] text-cyan-300/90">FUSING INTELLIGENCE GRAPH…</span>
        </div>
      )}

      {/* empty-state hint — blank canvas (NEW ANALYSIS) with no ingested evidence yet */}
      {!loading && nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10">
            <UploadCloud className="h-7 w-7 text-cyan-400" aria-hidden />
          </div>
          <div className="max-w-md">
            <div className="font-mono text-[13px] tracking-[0.16em] text-cyan-300">BLANK CANVAS · AWAITING EVIDENCE</div>
            <p className="mt-2 font-mono text-[10px] leading-relaxed tracking-wider text-slate-400">
              Upload your own FIR PDF, CDR CSV, bank statement or text note using the panel on the left. The graph builds dynamically from your content — entities are extracted with regex NER and operational relationships (OWNS · CALLED · TRANSFERRED_FUNDS · CO_ACCUSED · SPOTTED_AT) are parsed from sentence verbs. Edges with an explicit verb are CONFIRMED (bare label); edges tagged (INFERRED) are co-occurrence hypotheses — verify before acting. PageRank, betweenness, community detection, the AI copilot and the BSA §63 export all run on whatever you ingest.
            </p>
          </div>
          <button
            onClick={() => setLeftSheetOpen(true)}
            className="pointer-events-auto mt-1 flex items-center gap-2 rounded-md border border-cyan-500/50 bg-cyan-500/10 px-3.5 py-2 font-mono text-[10px] tracking-[0.18em] text-cyan-300 transition-colors hover:border-cyan-400 hover:bg-cyan-500/20 lg:hidden"
            aria-label="Open the evidence ingestion panel"
          >
            <UploadCloud className="h-3.5 w-3.5" aria-hidden />
            OPEN INGESTION PANEL
          </button>
        </div>
      )}

      {/* mobile: open control panel */}
      <button
        onClick={() => setLeftSheetOpen(true)}
        className="absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-tracex-panel/95 text-slate-300 shadow-lg transition-colors hover:border-cyan-500/60 hover:text-cyan-300 lg:hidden"
        aria-label="Open ingestion and filter panel"
      >
        <Network className="h-4 w-4" aria-hidden />
      </button>

      {/* graph toolbar */}
      <div className="absolute right-3 top-3 z-20 flex flex-col gap-1.5" role="toolbar" aria-label="Graph controls">
        <ToolbarButton label="Zoom in" title="Zoom in" onClick={() => zoom(1.25)}>
          <Plus className="h-4 w-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton label="Zoom out" title="Zoom out" onClick={() => zoom(0.8)}>
          <Minus className="h-4 w-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton label="Fit graph to view" title="Fit to view" onClick={refit}>
          <Maximize2 className="h-4 w-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton label="Recompute physics layout" title="Recompute layout" onClick={relayout}>
          <RefreshCw className="h-4 w-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="Toggle community clustering"
          title="Community clustering"
          onClick={toggleCluster}
          active={clusterMode}
        >
          <Network className="h-4 w-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="Centre graph on selected entity"
          title="Centre on selection"
          onClick={focusSelected}
          disabled={!selectedNodeId}
        >
          <Crosshair className="h-4 w-4" aria-hidden />
        </ToolbarButton>
      </div>

      {/* highlight banner */}
      {highlightNodeIds && highlightNodeIds.length > 0 && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan-500/50 bg-tracex-panel/95 px-3.5 py-1.5 shadow-lg shadow-cyan-500/10 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 tracex-pulse" aria-hidden />
          <span className="font-mono text-[9px] tracking-[0.18em] text-cyan-300">
            COPILOT FOCUS · {highlightNodeIds.length} NODES
          </span>
          <button
            onClick={() => setHighlight(null)}
            className="text-slate-500 transition-colors hover:text-rose-400"
            aria-label="Clear copilot highlight"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {/* live stats overlay */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden font-mono text-[9px] tracking-[0.16em] text-slate-500 sm:block">
        <span className="text-cyan-400/90">{stats.nodes}</span> NODES ·{' '}
        <span className="text-cyan-400/90">{stats.edges}</span> LINKS · DRAG / SCROLL / TAP NODE TO INSPECT
      </div>

      {/* legend overlay — node + edge type key so analysts can read the graph
          without guessing what each colour / line-style means */}
      <GraphLegend theme={resolvedTheme === 'light' ? 'light' : 'dark'} />
    </div>
  );
}

// ─── on-screen graph legend ───────────────────────────────────────────
// Toggles open/closed. Maps node shapes/colours and edge line-styles to
// their semantic meaning so the graph is self-documenting.

const LEGEND_NODES: Array<{ type: string; label: string; shape: string; color: string }> = [
  { type: 'PERSON', label: 'Person / Suspect', shape: 'ellipse', color: '#F43F5E' },
  { type: 'PHONE', label: 'Phone Number', shape: 'triangle', color: '#38BDF8' },
  { type: 'BANK_ACCOUNT', label: 'Bank Account', shape: 'round-rectangle', color: '#22C55E' },
  { type: 'VEHICLE', label: 'Vehicle', shape: 'diamond', color: '#A855F7' },
  { type: 'LOCATION', label: 'Location', shape: 'hexagon', color: '#FACC15' },
  { type: 'FIR', label: 'FIR / Evidence Doc', shape: 'tag', color: '#FB923C' },
];

const LEGEND_EDGES: Array<{ type: string; label: string; color: string; style: string }> = [
  { type: 'OWNS', label: 'Owns — confirmed verb / (INFERRED)', color: '#D97706', style: 'solid' },
  { type: 'CALLED', label: 'Called — confirmed verb / (INFERRED)', color: '#0EA5E9', style: 'dashed' },
  { type: 'TRANSFERRED_FUNDS', label: 'Funds transfer — confirmed verb', color: '#10B981', style: 'solid' },
  { type: 'CO_ACCUSED', label: 'Co-accused — explicit / (CO-OCCUR)', color: '#DC2626', style: 'solid' },
  { type: 'SPOTTED_AT', label: 'Spotted at — confirmed verb / (INFERRED)', color: '#A855F7', style: 'dotted' },
  { type: 'LINKED_TO', label: 'Document link (faint)', color: '#64748B', style: 'thin' },
];

function GraphLegend({ theme }: { theme: 'light' | 'dark' }) {
  const [open, setOpen] = useState(true);
  const isLight = theme === 'light';
  return (
    <div className={`absolute bottom-3 right-3 z-20 max-w-[220px] overflow-hidden rounded-lg border shadow-2xl backdrop-blur-md ${isLight ? 'border-slate-300 bg-white/92' : 'border-slate-700/80 bg-tracex-panel/95'}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between px-3 py-1.5 font-mono text-[9px] tracking-[0.16em] transition-colors ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-cyan-300 hover:bg-cyan-500/10'}`}
        aria-expanded={open}
        aria-label="Toggle graph legend"
      >
        <span>LEGEND</span>
        <span className="text-[8px] opacity-70">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-3 pb-2.5 pt-1">
          <div className={`mb-1.5 font-mono text-[7.5px] tracking-[0.18em] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            NODE TYPES
          </div>
          <ul className="space-y-1">
            {LEGEND_NODES.map((n) => (
              <li key={n.type} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 shrink-0 border border-white/40"
                  style={{
                    background: n.color,
                    borderRadius: n.shape === 'ellipse' ? '50%' : n.shape === 'round-rectangle' ? '3px' : n.shape === 'hexagon' ? '1px' : 0,
                  }}
                  aria-hidden
                />
                <span className={`font-mono text-[8.5px] leading-tight ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  {n.label}
                </span>
              </li>
            ))}
          </ul>
          <div className={`mb-1.5 mt-2.5 font-mono text-[7.5px] tracking-[0.18em] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            RELATIONSHIPS
          </div>
          <ul className="space-y-1">
            {LEGEND_EDGES.map((e) => (
              <li key={e.type} className="flex items-center gap-2">
                <svg width="26" height="8" className="shrink-0" aria-hidden>
                  {e.style === 'dashed' ? (
                    <line x1="0" y1="4" x2="24" y2="4" stroke={e.color} strokeWidth="1.6" strokeDasharray="3 2" />
                  ) : e.style === 'dotted' ? (
                    <line x1="0" y1="4" x2="24" y2="4" stroke={e.color} strokeWidth="1.6" strokeDasharray="1 2" />
                  ) : e.style === 'thin' ? (
                    <line x1="0" y1="4" x2="24" y2="4" stroke={e.color} strokeWidth="0.8" opacity="0.5" />
                  ) : (
                    <line x1="0" y1="4" x2="24" y2="4" stroke={e.color} strokeWidth="2" />
                  )}
                  <polygon points="24,1 28,4 24,7" fill={e.color} />
                </svg>
                <span className={`font-mono text-[8.5px] leading-tight ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  {e.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

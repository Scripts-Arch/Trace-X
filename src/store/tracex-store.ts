'use client';

// TRACE-X // Client state orchestration (Zustand)

import { create } from 'zustand';
import {
  ALL_NODE_TYPES,
  CopilotResponse,
  EvidenceRecord,
  MetricsMap,
  TraceXEdge,
  TraceXNode,
  NodeType,
} from '@/lib/tracex/types';
import { computeMetrics } from '@/lib/tracex/centrality';

export interface CaseMeta {
  id: string;
  codename: string;
  agency: string;
  desk: string;
  status: string;
  summary: string;
  nodeCount?: number;
  edgeCount?: number;
}

export interface CaseListItem extends CaseMeta {
  nodeCount: number;
  edgeCount: number;
  topRisk?: { label: string; riskScore: number };
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'copilot';
  text?: string;
  response?: CopilotResponse;
  error?: boolean;
  timestamp: number;
}

const DAY = 24 * 60 * 60 * 1000;
/** deterministic initial window (avoids SSR/client hydration mismatch);
 *  replaced by real edge bounds as soon as a case loads */
const INITIAL_RANGE: [number, number] = [
  new Date('2024-01-01T00:00:00Z').getTime(),
  new Date('2024-06-30T00:00:00Z').getTime(),
];

function edgeBounds(edges: TraceXEdge[]): [number, number] {
  if (!edges.length) {
    const now = Date.now();
    return [now - 180 * DAY, now];
  }
  let min = Infinity;
  let max = -Infinity;
  for (const e of edges) {
    const t = new Date(e.date).getTime();
    if (isNaN(t)) continue;
    min = Math.min(min, t);
    max = Math.max(max, t);
  }
  if (!isFinite(min)) {
    const now = Date.now();
    return [now - 180 * DAY, now];
  }
  // pad by a couple of days on each side for a comfortable slider
  return [min - 2 * DAY, max + 2 * DAY];
}

interface TraceXState {
  /* data */
  cases: CaseListItem[];
  caseMeta: CaseMeta | null;
  nodes: TraceXNode[];
  edges: TraceXEdge[];
  metrics: MetricsMap;
  evidence: EvidenceRecord[];
  loading: boolean;
  uploadBusy: boolean;
  resetBusy: boolean;

  /* filters + ui */
  visibleTypes: NodeType[];
  fullRange: [number, number];
  dateRange: [number, number];
  selectedNodeId: string | null;
  highlightNodeIds: string[] | null;
  clusterMode: boolean;
  leftSheetOpen: boolean;
  copilotOpen: boolean;
  copilotBusy: boolean;
  copilotMessages: CopilotMessage[];

  /* actions */
  loadCases: () => Promise<void>;
  openCase: (caseId: string) => Promise<void>;
  resetCase: () => Promise<void>;
  toggleType: (t: NodeType) => void;
  setAllTypes: (on: boolean) => void;
  setDateRange: (r: [number, number]) => void;
  resetDateRange: () => void;
  selectNode: (id: string | null) => void;
  setHighlight: (ids: string[] | null) => void;
  setClusterMode: (on: boolean) => void;
  setLeftSheetOpen: (open: boolean) => void;
  setCopilotOpen: (open: boolean) => void;
  uploadFile: (file: File) => Promise<{ nodeCount: number; edgeCount: number; entityCount: number; extractionMethod?: string } | null>;
  askCopilot: (query: string) => Promise<void>;
  clearCopilot: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const useTraceXStore = create<TraceXState>()((set, get) => ({
  cases: [],
  caseMeta: null,
  nodes: [],
  edges: [],
  metrics: {},
  evidence: [],
  loading: true,
  uploadBusy: false,
  resetBusy: false,

  visibleTypes: [...ALL_NODE_TYPES],
  fullRange: INITIAL_RANGE,
  dateRange: INITIAL_RANGE,
  selectedNodeId: null,
  highlightNodeIds: null,
  clusterMode: false,
  leftSheetOpen: false,
  copilotOpen: false,
  copilotBusy: false,
  copilotMessages: [],

  loadCases: async () => {
    try {
      const res = await fetch('/api/cases');
      const data = await res.json();
      set({ cases: data.cases ?? [] });
    } catch {
      console.warn('[tracex] case list unavailable');
    }
  },

  openCase: async (caseId) => {
    set({ loading: true, selectedNodeId: null, highlightNodeIds: null, clusterMode: false });
    try {
      const [graphRes, evidenceRes] = await Promise.all([fetch(`/api/graph?caseId=${caseId}`), fetch(`/api/evidence?caseId=${caseId}`)]);
      if (!graphRes.ok) {
        console.warn(`[tracex] graph load failed: ${graphRes.status} for case ${caseId}`);
        set({ loading: false });
        return;
      }
      const graph = await graphRes.json();
      const ev = await evidenceRes.json();
      const bounds = edgeBounds(graph.edges ?? []);
      set({
        caseMeta: graph.case,
        nodes: graph.nodes ?? [],
        edges: graph.edges ?? [],
        metrics: graph.metrics ?? {},
        evidence: ev.evidence ?? [],
        loading: false,
        visibleTypes: [...ALL_NODE_TYPES],
        fullRange: bounds,
        dateRange: bounds,
      });
    } catch {
      console.warn(`[tracex] case open failed (network) for ${caseId}`);
      set({ loading: false });
    }
  },

  resetCase: async () => {
    const caseId = get().caseMeta?.id;
    if (!caseId) return;
    set({ resetBusy: true });
    try {
      const res = await fetch(`/api/reset?caseId=${encodeURIComponent(caseId)}`, { method: 'POST' });
      if (!res.ok) throw new Error(`Reset failed (${res.status})`);
      const data = await res.json();
      const bounds = edgeBounds(data.edges ?? []);
      set({
        nodes: data.nodes ?? [],
        edges: data.edges ?? [],
        metrics: data.metrics ?? {},
        evidence: [],
        selectedNodeId: null,
        highlightNodeIds: null,
        clusterMode: false,
        visibleTypes: [...ALL_NODE_TYPES],
        fullRange: bounds,
        dateRange: bounds,
        resetBusy: false,
      });
    } catch (err) {
      console.error('[tracex] reset error:', err);
      set({ resetBusy: false });
    }
  },

  toggleType: (t) => {
    const { visibleTypes } = get();
    set({
      visibleTypes: visibleTypes.includes(t) ? visibleTypes.filter((x) => x !== t) : [...visibleTypes, t],
    });
  },

  setAllTypes: (on) => set({ visibleTypes: on ? [...ALL_NODE_TYPES] : [] }),

  setDateRange: (r) => set({ dateRange: r }),

  resetDateRange: () => set((s) => ({ dateRange: [...s.fullRange] as [number, number] })),

  selectNode: (id) => set({ selectedNodeId: id }),

  setHighlight: (ids) => set({ highlightNodeIds: ids }),

  setClusterMode: (on) => set({ clusterMode: on }),

  setLeftSheetOpen: (open) => set({ leftSheetOpen: open }),

  setCopilotOpen: (open) => set({ copilotOpen: open }),

  uploadFile: async (file) => {
    set({ uploadBusy: true });
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('caseId', get().caseMeta?.id ?? 'case-eagle-claw');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();

      const newNodes: TraceXNode[] = data.nodes ?? [];
      const newEdges: TraceXEdge[] = data.edges ?? [];
      const mergedNodes = [...get().nodes];
      const nodeIds = new Set(mergedNodes.map((n) => n.id));
      for (const n of newNodes) if (!nodeIds.has(n.id)) mergedNodes.push(n);
      const mergedEdges = [...get().edges];
      const edgeIds = new Set(mergedEdges.map((e) => e.id));
      for (const e of newEdges) if (!edgeIds.has(e.id)) mergedEdges.push(e);

      const bounds = edgeBounds(mergedEdges);
      const current = get().dateRange;
      set({
        nodes: mergedNodes,
        edges: mergedEdges,
        metrics: computeMetrics(mergedNodes, mergedEdges),
        evidence: [data.evidence, ...get().evidence],
        fullRange: bounds,
        // widen the temporal window so freshly ingested links are visible
        dateRange: [Math.min(current[0], bounds[0]), Math.max(current[1], bounds[1])],
        uploadBusy: false,
      });
      return {
        nodeCount: newNodes.length,
        edgeCount: newEdges.length,
        entityCount: data.evidence?.entityCount ?? 0,
        extractionMethod: data.extractionMethod as string | undefined,
      };
    } catch (err) {
      console.error('[tracex] upload error:', err);
      set({ uploadBusy: false });
      return null;
    }
  },

  askCopilot: async (query) => {
    const q = query.trim();
    if (!q || get().copilotBusy) return;
    const history = get()
      .copilotMessages.slice(-6)
      .map((m) => ({ role: m.role, content: (m.role === 'user' ? m.text : m.response?.narrative) ?? '' }))
      .filter((m) => m.content.length > 0);

    set({
      copilotMessages: [...get().copilotMessages, { id: uid(), role: 'user', text: q, timestamp: Date.now() }],
      copilotBusy: true,
      copilotOpen: true,
    });

    try {
      // Send the live merged graph (seed + ingested evidence) so the copilot
      // can answer questions about freshly-uploaded FIR/CDR/bank content on a
      // blank canvas — not just the pre-seeded mock cases. The server falls
      // back to findCase() if this payload is absent.
      const liveNodes = get().nodes;
      const liveEdges = get().edges;
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          caseId: get().caseMeta?.id ?? 'case-eagle-claw',
          history,
          graph:
            liveNodes.length > 0
              ? {
                  nodes: liveNodes.map((n) => ({
                    id: n.id,
                    type: n.type,
                    label: n.label,
                    alias: n.alias,
                    flags: n.flags,
                    kingpin: n.kingpin,
                  })),
                  edges: liveEdges.map((e) => ({
                    source: e.source,
                    target: e.target,
                    type: e.type,
                    date: e.date,
                    weight: e.weight,
                  })),
                }
              : undefined,
        }),
      });
      if (!res.ok) throw new Error('Copilot unavailable');
      const data: CopilotResponse = await res.json();
      set({
        copilotMessages: [...get().copilotMessages, { id: uid(), role: 'copilot', response: data, timestamp: Date.now() }],
        copilotBusy: false,
        highlightNodeIds: data.matchingNodeIds?.length ? data.matchingNodeIds : null,
      });
    } catch {
      set({
        copilotMessages: [
          ...get().copilotMessages,
          {
            id: uid(),
            role: 'copilot',
            error: true,
            response: {
              interpretation: 'Copilot link lost',
              cypher: '// uplink to TRACE-X LM inference cluster failed\nMATCH (n) RETURN n',
              narrative: 'The inference backend could not be reached. Check uplink status and retry — offline analytics remain available through the suggestion chips.',
              matchingNodeIds: [],
              source: 'OFFLINE-ANALYTICS',
            },
            timestamp: Date.now(),
          },
        ],
        copilotBusy: false,
      });
    }
  },

  clearCopilot: () => set({ copilotMessages: [], highlightNodeIds: null }),
}));

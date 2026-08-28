// TRACE-X // Graph analytics engine
// Pure-TypeScript implementations of PageRank, Brandes' betweenness
// centrality, composite risk scoring and label-propagation community
// detection. Operates on the undirected projection of the network.

import { TraceXEdge, TraceXNode, MetricsMap, riskBandOf, NodeType } from './types';

type Adjacency = Map<string, Set<string>>;

/** Edge types that are pure provenance (document → entity star edges).
 *  These inflate document-node centrality without carrying operational
 *  meaning, so they are EXCLUDED from PageRank / betweenness / degree /
 *  community computation. The real network is the entity↔entity
 *  inferred edges (OWNS, CALLED, TRANSFERRED_FUNDS, CO_ACCUSED,
 *  SPOTTED_AT, USES). This makes real kingpins (people) surface at the
 *  apex of the risk index instead of the FIR document hub. */
const PROVENANCE_EDGES = new Set(['LINKED_TO', 'NAMES_ACCUSED']);

function operationalEdges(edges: TraceXEdge[]): TraceXEdge[] {
  return edges.filter((e) => !PROVENANCE_EDGES.has(e.type));
}

export function buildAdjacency(nodeIds: string[], edges: TraceXEdge[]): Adjacency {
  const adj: Adjacency = new Map(nodeIds.map((id) => [id, new Set<string>()]));
  for (const e of edges) {
    if (!adj.has(e.source) || !adj.has(e.target)) continue;
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  return adj;
}

/** Power-iteration PageRank on the undirected graph. */
export function pageRank(nodeIds: string[], edges: TraceXEdge[], damping = 0.85, iterations = 60): Map<string, number> {
  const adj = buildAdjacency(nodeIds, edges);
  const n = nodeIds.length;
  const pr = new Map<string, number>(nodeIds.map((id) => [id, 1 / n]));
  if (n === 0) return pr;

  for (let it = 0; it < iterations; it++) {
    const next = new Map<string, number>();
    let leak = 0;
    for (const id of nodeIds) {
      const nbrs = adj.get(id)!;
      let inbound = 0;
      for (const nb of nbrs) {
        const nbDeg = adj.get(nb)!.size || 1;
        inbound += (pr.get(nb) ?? 0) / nbDeg;
      }
      const val = (1 - damping) / n + damping * inbound;
      next.set(id, val);
      leak += val;
    }
    // re-normalise so the mass sums to 1
    for (const id of nodeIds) pr.set(id, (next.get(id) ?? 0) / (leak || 1));
  }
  return pr;
}

/** Brandes' algorithm — normalised betweenness centrality (undirected). */
export function betweenness(nodeIds: string[], edges: TraceXEdge[]): Map<string, number> {
  const adj = buildAdjacency(nodeIds, edges);
  const cb = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const n = nodeIds.length;
  if (n < 3) return cb;

  const dist = new Map<string, number>();
  const sigma = new Map<string, number>();
  const pred = new Map<string, string[]>();
  const delta = new Map<string, number>();

  for (const s of nodeIds) {
    dist.clear(); sigma.clear(); pred.clear(); delta.clear();
    for (const v of nodeIds) {
      pred.set(v, []); sigma.set(v, 0); dist.set(v, -1); delta.set(v, 0);
    }
    const stack: string[] = [];
    const queue: string[] = [s];
    sigma.set(s, 1); dist.set(s, 0);

    while (queue.length) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of adj.get(v) ?? []) {
        if (dist.get(w) === -1) {
          dist.set(w, dist.get(v)! + 1);
          queue.push(w);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }

    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred.get(w) ?? []) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      }
      if (w !== s) cb.set(w, cb.get(w)! + delta.get(w)!);
    }
  }

  const norm = ((n - 1) * (n - 2)) / 2 || 1;
  for (const id of nodeIds) cb.set(id, cb.get(id)! / 2 / norm);
  return cb;
}

const TYPE_BASE: Record<NodeType, number> = {
  PERSON: 1.0,
  PHONE: 0.62,
  BANK_ACCOUNT: 0.62,
  VEHICLE: 0.42,
  LOCATION: 0.38,
  FIR: 0.3,
};

/**
 * Composite TRACE-X risk index:
 *   38% PageRank · 30% Betweenness · 17% Degree · 15% entity-type base
 * Analyst flag override adds up to +6 for designated KINGPIN targets.
 */
export function computeMetrics(nodes: TraceXNode[], edges: TraceXEdge[]): MetricsMap {
  const ids = nodes.map((n) => n.id);
  // PageRank / betweenness / degree operate on the OPERATIONAL subgraph
  // only (entity↔entity inferred edges). Provenance star-edges from FIR
  // document nodes are excluded so a document hub can't dominate the
  // kingpin ranking — real people surface at the apex instead.
  const ops = operationalEdges(edges);
  const pr = pageRank(ids, ops);
  const bw = betweenness(ids, ops);

  const maxPr = Math.max(...ids.map((i) => pr.get(i) ?? 0), 1e-9);
  const maxBw = Math.max(...ids.map((i) => bw.get(i) ?? 0), 1e-9);
  const maxDeg = Math.max(...ids.map((i) => degreeOf(nodes, ops, i)), 1);

  const raw = ids.map((id) => {
    const node = nodes.find((n) => n.id === id)!;
    const deg = degreeOf(nodes, ops, id);
    let score =
      38 * ((pr.get(id) ?? 0) / maxPr) +
      30 * ((bw.get(id) ?? 0) / maxBw) +
      17 * (deg / maxDeg) +
      15 * TYPE_BASE[node.type];
    if (node.flags?.includes('KINGPIN')) score += 6;
    // FIR document nodes are provenance anchors, not suspects — cap their
    // risk so they never appear as CRITICAL kingpins in the top ranking.
    if (node.type === 'FIR') score = Math.min(score, 42);
    score = Math.max(4, Math.min(99, Math.round(score)));
    return {
      id,
      degree: deg,
      pageRank: pr.get(id) ?? 0,
      betweenness: bw.get(id) ?? 0,
      riskScore: score,
    };
  });

  raw.sort((a, b) => b.riskScore - a.riskScore);
  const metrics: MetricsMap = {};
  raw.forEach((r, i) => {
    metrics[r.id] = {
      degree: r.degree,
      pageRank: r.pageRank,
      betweenness: r.betweenness,
      riskScore: r.riskScore,
      riskBand: riskBandOf(r.riskScore),
      rank: i + 1,
    };
  });
  return metrics;
}

export function degreeOf(nodes: TraceXNode[], edges: TraceXEdge[], nodeId: string): number {
  const ids = new Set(nodes.map((n) => n.id));
  return edges.filter((e) => (e.source === nodeId || e.target === nodeId) && ids.has(e.source) && ids.has(e.target)).length;
}

/** Deterministic label-propagation community detection (cluster mode).
 *  Runs on the OPERATIONAL subgraph so document hubs don't merge every
 *  entity into a single community.
 *
 *  Nodes that have NO operational edges (FIR document nodes whose only edges
 *  are provenance LINKED_TO / NAMES_ACCUSED, plus orphaned entities whose
 *  inferred edges were lost to pronoun resolution failures) are deliberately
 *  excluded from the partition — otherwise each one becomes a single-node
 *  "community" that inflates the community count and clutters the BSA §63
 *  report's "compartment" wording. They simply get no cluster assignment
 *  (and GraphCanvas leaves them uncoloured). */
export function detectCommunities(nodes: TraceXNode[], edges: TraceXEdge[]): Map<string, number> {
  const ops = operationalEdges(edges);
  // Build the set of nodes that participate in at least one operational edge.
  const opsNodeIds = new Set<string>();
  for (const e of ops) {
    opsNodeIds.add(e.source);
    opsNodeIds.add(e.target);
  }
  // Only run label propagation over operationally-connected nodes.
  const ids = nodes.map((n) => n.id).filter((id) => opsNodeIds.has(id)).sort();
  const adj = buildAdjacency(ids, ops);
  const labels = new Map<string, number>(ids.map((id, i) => [id, i]));

  for (let iter = 0; iter < 25; iter++) {
    let changed = false;
    for (const id of ids) {
      const nbrs = [...(adj.get(id) ?? [])];
      if (!nbrs.length) continue;
      const counts = new Map<number, number>();
      for (const nb of nbrs) {
        const l = labels.get(nb)!;
        counts.set(l, (counts.get(l) ?? 0) + 1);
      }
      let best = labels.get(id)!;
      let bestCount = -1;
      for (const [l, c] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
        if (c > bestCount) {
          best = l;
          bestCount = c;
        }
      }
      if (best !== labels.get(id)) {
        labels.set(id, best);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // compact label space to 0..k
  const seen = new Map<number, number>();
  const out = new Map<string, number>();
  for (const id of ids) {
    const l = labels.get(id)!;
    if (!seen.has(l)) seen.set(l, seen.size);
    out.set(id, seen.get(l)!);
  }
  return out;
}

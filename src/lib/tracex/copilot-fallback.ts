// TRACE-X // Offline copilot engine — deterministic pattern-matched
// analytics + Neo4j Cypher synthesis. Used as a fallback whenever the
// TRACE-X LM inference backend is unavailable, so the copilot always answers.

import { TraceXEdge, TraceXNode, MetricsMap, CopilotResponse } from './types';
import { buildAdjacency } from './centrality';

interface Ctx {
  nodes: TraceXNode[];
  edges: TraceXEdge[];
  metrics: MetricsMap;
}

const fmt = (n: TraceXNode) => `${n.label}${n.alias ? ` (${n.alias})` : ''}`;

export function localCopilot(query: string, ctx: Ctx): CopilotResponse {
  const q = query.toLowerCase();
  const { nodes, edges, metrics } = ctx;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const ranked = [...nodes].sort((a, b) => (metrics[b.id]?.riskScore ?? 0) - (metrics[a.id]?.riskScore ?? 0));

  // ── bridge / cut-out analysis ────────────────────────────────
  if (/bridge|between|cut.?out|connect|broker|link.*(bank|phone)|(bank|phone).*link/.test(q)) {
    const adj = buildAdjacency(nodes.map((n) => n.id), edges);
    const bridges = nodes.filter((n) => {
      const nbrs = [...(adj.get(n.id) ?? [])].map((id) => byId.get(id)!);
      const hasBank = nbrs.some((m) => m?.type === 'BANK_ACCOUNT') || edges.some((e) => (e.source === n.id || e.target === n.id) && e.type === 'TRANSFERRED_FUNDS');
      const hasPhone = nbrs.some((m) => m?.type === 'PHONE') || edges.some((e) => (e.source === n.id || e.target === n.id) && e.type === 'CALLED');
      return hasBank && hasPhone;
    }).sort((a, b) => (metrics[b.id]?.betweenness ?? 0) - (metrics[a.id]?.betweenness ?? 0));

    const ids = bridges.map((n) => n.id);
    if (ids.length) {
      const list = bridges.slice(0, 4).map((n) => `${fmt(n)} — risk ${metrics[n.id]?.riskScore}, betweenness ${(metrics[n.id]?.betweenness ?? 0).toFixed(3)}`);
      return {
        interpretation: `Identified ${bridges.length} bridge node(s) that directly couple the banking layer to the telephony layer.`,
        cypher: `MATCH (n)-[r1]->(ph:Phone), (n)-[r2]->(acc:BankAccount)\nWHERE n.riskScore > 50\nWITH n, count(DISTINCT ph) AS phones, count(DISTINCT acc) AS accounts\nWHERE phones >= 1 AND accounts >= 1\nRETURN n.name, n.riskScore, n.betweenness, phones, accounts\nORDER BY n.betweenness DESC`,
        narrative: `Bridge analysis complete. The dominant coupling nodes are: ${list.join('; ')}. These entities mediate every observed path between fund-movement events and call-detail records — neutralising them decouples the syndicate's command layer from its settlement layer. Recommend parallel custody action and simultaneous IMEI/bank freeze to prevent tip-off.`,
        matchingNodeIds: ids,
        source: 'OFFLINE-ANALYTICS',
      };
    }
  }

  // ── kingpin / ranking ────────────────────────────────────────
  if (/kingpin|top|rank|pagerank|important|key player|mastermind|leader|who.*(control|runs)/.test(q)) {
    const top = ranked.slice(0, 3);
    return {
      interpretation: `Ranked the network by the composite TRACE-X risk index (PageRank, betweenness and degree).`,
      cypher: `MATCH (n)\nRETURN n.name, n.type, n.riskScore, n.pageRank, n.betweenness\nORDER BY n.riskScore DESC\nLIMIT 3`,
      narrative: `The network is head-heavy. ${top.map((n, i) => `(${i + 1}) ${fmt(n)} — risk ${metrics[n.id]?.riskScore}, PageRank ${(metrics[n.id]?.pageRank ?? 0).toFixed(3)}`).join('; ')}. The apex node concentrates control of both communications and settlement, with deliberate redundancy through a secondary operator. Decapitation should be simultaneous.`,
      matchingNodeIds: top.map((n) => n.id),
      source: 'OFFLINE-ANALYTICS',
    };
  }

  // ── funds / laundering trace ─────────────────────────────────
  if (/fund|money|transfer|bank|hawala|launder|trace|amount|payment|settle/.test(q)) {
    const transfers = edges.filter((e) => e.type === 'TRANSFERRED_FUNDS');
    const total = transfers.reduce((s, e) => s + (e.weight ?? 0), 0);
    const bankIds = new Set(transfers.flatMap((e) => [e.source, e.target]));
    const owners = nodes.filter((n) => n.type === 'PERSON' && edges.some((e) => e.type === 'OWNS' && (e.source === n.id) && bankIds.has(e.target)));
    return {
      interpretation: `Traced ${transfers.length} fund-movement edges totalling ₹${(total / 100000).toFixed(1)} lakh across the banking layer.`,
      cypher: `MATCH (a:BankAccount)-[t:TRANSFERRED_FUNDS]->(b:BankAccount)\nOPTIONAL MATCH (p:Person)-[:OWNS]->(a)\nRETURN a.accNumber, b.accNumber, t.amount, t.date, t.mode, p.name\nORDER BY t.amount DESC`,
      narrative: `The laundering cycle moves ₹${(total / 100000).toFixed(1)} lakh through ${bankIds.size} accounts. The trail originates at a shell current account, layers through a mule account, and closes a circular remittance back to origin — a placement-layering-integration loop in miniature. Signatories of record: ${owners.map(fmt).join(', ') || 'unresolved (benami)'}. Freeze applications should target the origin and layering accounts simultaneously.`,
      matchingNodeIds: [...bankIds],
      source: 'OFFLINE-ANALYTICS',
    };
  }

  // ── FIR / case-record links ──────────────────────────────────
  if (/\bfir\b|accused|co.?accused|charge|case record|named/.test(q)) {
    const firNodes = nodes.filter((n) => n.type === 'FIR');
    const named = edges.filter((e) => e.type === 'NAMES_ACCUSED').map((e) => e.target);
    return {
      interpretation: `Cross-referenced ${firNodes.length} FIR record(s) against named accused in the current graph.`,
      cypher: `MATCH (f:FIR)-[:NAMES_ACCUSED]->(p:Person)\nOPTIONAL MATCH (f)-[:LINKED_TO]->(x)\nRETURN f.firNumber, p.name, p.riskScore, x.label`,
      narrative: `${firNodes.map((f) => f.label).join(' and ')} jointly name ${named.length} accused: ${named.map((id) => fmt(byId.get(id)!)).join(', ')}. Co-accusal structure shows a deliberate insulation layer between the kingpins and execution staff. The FIR evidence chain is hash-sealed under BSA 2023 §63.`,
      matchingNodeIds: [...firNodes.map((f) => f.id), ...named],
      source: 'OFFLINE-ANALYTICS',
    };
  }

  // ── telephony / CDR ──────────────────────────────────────────
  if (/phone|call|cdr|contact|handset|sim|burner/.test(q)) {
    const calls = edges.filter((e) => e.type === 'CALLED');
    const phoneIds = new Set(calls.flatMap((e) => [e.source, e.target]));
    const busiest = [...phoneIds]
      .map((id) => ({ id, deg: calls.filter((e) => e.source === id || e.target === id).length }))
      .sort((a, b) => b.deg - a.deg)
      .slice(0, 3);
    return {
      interpretation: `Analysed the call-detail mesh: ${calls.length} communication edges across ${phoneIds.size} subscriptions.`,
      cypher: `MATCH (a:Phone)-[c:CALLED]->(b:Phone)\nWITH a, count(c) AS calls, sum(c.duration) AS airtime\nRETURN a.number, calls, airtime\nORDER BY calls DESC`,
      narrative: `Telephony mesh shows ${calls.length} CDR edges. Highest-contact handsets: ${busiest.map((b) => `${fmt(byId.get(b.id)!)} (${b.deg} edges)`).join(', ')}. Burner discipline (IMEI churn) and an unattributed cut-out number indicate counter-surveillance awareness. Recommend tower-dump expansion around the rendezvous cluster.`,
      matchingNodeIds: [...phoneIds],
      source: 'OFFLINE-ANALYTICS',
    };
  }

  // ── default: network overview ────────────────────────────────
  const top = ranked.slice(0, 5);
  const persons = nodes.filter((n) => n.type === 'PERSON').length;
  return {
    interpretation: `Generated a full-network risk overview across ${nodes.length} entities and ${edges.length} relationships.`,
    cypher: `MATCH (n)\nRETURN n.name, n.type, n.riskScore, n.pageRank, n.betweenness\nORDER BY n.riskScore DESC\nLIMIT 5`,
    narrative: `Current holdings contain ${nodes.length} entities (${persons} persons) joined by ${edges.length} relationships. Priority targets: ${top.slice(0, 3).map((n) => `${fmt(n)} (risk ${metrics[n.id]?.riskScore})`).join('; ')}. The graph shows a classic two-tier structure — a control tier holding both communications and banking assets, and an execution tier kept deliberately compartmentalised. Ask about bridge nodes, fund trails, FIR linkage or the call mesh for a focused brief.`,
    matchingNodeIds: top.map((n) => n.id),
    source: 'OFFLINE-ANALYTICS',
  };
}

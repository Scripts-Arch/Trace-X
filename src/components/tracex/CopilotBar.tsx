'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  Eraser,
  Send,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTraceXStore } from '@/store/tracex-store';
import { NODE_COLORS } from '@/lib/tracex/types';

const SUGGESTIONS = [
  'Show all high-risk bridge nodes connecting bank transfers to phone numbers',
  'Who are the top kingpins by PageRank?',
  'Trace the full fund-flow trail with amounts',
  'List everyone named in an FIR record',
  'Analyse the call mesh between burner phones',
];

// minimal Cypher keyword highlighter (safe, token-based)
const CYPHER_KEYWORDS = new Set([
  'MATCH', 'OPTIONAL', 'WITH', 'WHERE', 'RETURN', 'ORDER', 'BY', 'LIMIT',
  'AS', 'AND', 'OR', 'NOT', 'DISTINCT', 'DESC', 'ASC', 'COUNT', 'SUM',
  'COLLECT', 'UNWIND', 'CREATE', 'MERGE', 'DELETE', 'SET',
]);

function CypherBlock({ code }: { code: string }) {
  const copy = () => {
    navigator.clipboard
      .writeText(code)
      .then(() => toast.success('Cypher query copied'))
      .catch(() => toast.error('Clipboard unavailable'));
  };
  return (
    <div className="relative rounded-md border border-cyan-500/25 bg-tracex-cypher">
      <div className="flex items-center justify-between border-b border-cyan-500/15 px-2.5 py-1">
        <span className="flex items-center gap-1.5 font-mono text-[8px] tracking-[0.2em] text-cyan-500/80">
          <Terminal className="h-3 w-3" aria-hidden />
          AUTO-GENERATED CYPHER
        </span>
        <button
          onClick={copy}
          className="text-slate-500 transition-colors hover:text-cyan-300"
          aria-label="Copy Cypher query"
        >
          <Copy className="h-3 w-3" aria-hidden />
        </button>
      </div>
      <pre className="max-h-40 overflow-auto p-2.5 font-mono text-[9.5px] leading-relaxed text-cyan-100/85">
        {code.split('\n').map((line, i) => (
          <div key={i} className="whitespace-pre">
            {line.split(/(\s+|[(),.:]|->)/).map((tok, j) =>
              CYPHER_KEYWORDS.has(tok) ? (
                <span key={j} className="text-cyan-400 font-bold">
                  {tok}
                </span>
              ) : (
                <span key={j}>{tok}</span>
              )
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function CopilotBar() {
  const open = useTraceXStore((s) => s.copilotOpen);
  const setOpen = useTraceXStore((s) => s.setCopilotOpen);
  const busy = useTraceXStore((s) => s.copilotBusy);
  const messages = useTraceXStore((s) => s.copilotMessages);
  const askCopilot = useTraceXStore((s) => s.askCopilot);
  const clearCopilot = useTraceXStore((s) => s.clearCopilot);
  const nodes = useTraceXStore((s) => s.nodes);
  const metrics = useTraceXStore((s) => s.metrics);
  const selectNode = useTraceXStore((s) => s.selectNode);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  const submit = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    await askCopilot(q);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3">
      <div
        className={`pointer-events-auto w-full max-w-3xl rounded-xl border shadow-2xl shadow-cyan-500/10 backdrop-blur-md transition-all duration-300 ${
          open ? 'bg-tracex-copilot/95 border-slate-700/80' : 'bg-tracex-copilot/80 border-slate-800/80 hover:border-slate-600'
        }`}
        role="complementary"
        aria-label="AI intelligence copilot"
      >
        {/* header row */}
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left"
          aria-expanded={open}
          aria-label={open ? 'Collapse AI copilot' : 'Expand AI copilot'}
        >
          <span className="relative flex h-7 w-7 items-center justify-center rounded-md border border-cyan-500/40 bg-cyan-500/10">
            <BrainCircuit className="h-4 w-4 text-cyan-400" aria-hidden />
            {busy && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-cyan-400 tracex-pulse" aria-hidden />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] font-bold tracking-[0.22em] text-slate-200">
              AI INTELLIGENCE COPILOT
              {busy && <span className="ml-2 text-cyan-400 tracex-blink">▊ ANALYSING</span>}
            </div>
            <div className="hidden sm:block truncate font-mono text-[8px] tracking-[0.18em] text-slate-600">
              NATURAL-LANGUAGE GRAPH INTERROGATION · CYPHER SYNTHESIS · RISK PRIORITISATION
            </div>
          </div>
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          ) : (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          )}
        </button>

        {open && (
          <div className="border-t border-slate-800/70">
            {/* conversation */}
            {messages.length > 0 && (
              <div ref={scrollRef} className="max-h-56 overflow-y-auto px-4 py-3 flex flex-col gap-3" aria-live="polite">
                {messages.map((msg) =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-lg rounded-br-sm border border-slate-700 bg-slate-800/70 px-3 py-2 font-mono text-[10px] leading-relaxed text-slate-200">
                        <span className="mr-1.5 text-[8px] tracking-[0.18em] text-cyan-500">QUERY ▸</span>
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex gap-2.5">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div
                          className={`rounded-lg rounded-tl-sm border px-3 py-2 font-mono text-[10px] leading-relaxed ${
                            msg.error ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-slate-800 bg-slate-900/70 text-slate-300'
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2 text-[8px] tracking-[0.2em] text-slate-500">
                            <Cpu className="h-3 w-3 text-cyan-500" aria-hidden />
                            {msg.response?.source === 'TRACE-X LM' ? 'TRACE-X LM v2 · INFERENCE' : 'OFFLINE ANALYTICS ENGINE'}
                          </div>
                          {msg.response?.interpretation}
                        </div>
                        {msg.response?.cypher && <CypherBlock code={msg.response.cypher} />}
                        <p className="pl-1 font-mono text-[9.5px] leading-relaxed text-slate-400">{msg.response?.narrative}</p>
                        {msg.response?.matchingNodeIds && msg.response.matchingNodeIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-1">
                            <span className="font-mono text-[8px] tracking-[0.16em] text-slate-600">FOCUS:</span>
                            {msg.response.matchingNodeIds
                              .map((id) => ({ node: nodes.find((n) => n.id === id), id }))
                              .filter((x) => x.node)
                              .slice(0, 8)
                              .map(({ node, id }) => (
                                <button
                                  key={id}
                                  onClick={() => selectNode(id)}
                                  className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 font-mono text-[8.5px] text-slate-300 transition-colors hover:border-cyan-500/60 hover:text-cyan-300"
                                  style={{ boxShadow: `inset 0 0 0 1px ${NODE_COLORS[node!.type]}22` }}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: NODE_COLORS[node!.type] }} aria-hidden />
                                  {node!.label.length > 26 ? `${node!.label.slice(0, 24)}…` : node!.label}
                                  {metrics[id] && <span className="text-rose-400/80">R{metrics[id].riskScore}</span>}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
                {busy && (
                  <div className="flex items-center gap-2 pl-6 font-mono text-[9px] tracking-[0.18em] text-cyan-400/80">
                    <span className="tracex-blink">▮</span> QUERYING FUSION GRAPH…
                  </div>
                )}
              </div>
            )}

            {/* suggestion chips */}
            <div className="flex gap-1.5 overflow-x-auto px-4 py-2.5" role="list" aria-label="Suggested queries">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void askCopilot(s)}
                  disabled={busy}
                  className="shrink-0 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 font-mono text-[8.5px] tracking-wide text-slate-400 transition-colors hover:border-cyan-500/50 hover:text-cyan-300 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* input */}
            <div className="flex items-center gap-2 border-t border-slate-800/70 p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder="Ask AI Copilot… e.g. show high-risk bridge nodes linking funds to phones"
                aria-label="Ask the AI copilot"
                className="h-10 flex-1 rounded-md border border-slate-700 bg-tracex-bg px-3 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              />
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearCopilot}
                  className="h-10 w-10 shrink-0 border border-slate-700/70 text-slate-500 hover:text-rose-300"
                  aria-label="Clear copilot conversation"
                >
                  <Eraser className="h-3.5 w-3.5" aria-hidden />
                </Button>
              )}
              <Button
                onClick={() => void submit()}
                disabled={busy || !input.trim()}
                className="h-10 w-10 shrink-0 border border-cyan-500/50 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 hover:text-cyan-200 disabled:opacity-35"
                aria-label="Send query to copilot"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

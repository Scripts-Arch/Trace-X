'use client';

import { useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTraceXStore } from '@/store/tracex-store';
import { ClassificationBanner } from './ClassificationBanner';
import { TopBar } from './TopBar';
import { LeftPanel } from './LeftPanel';
import { GraphCanvas } from './GraphCanvas';
import { InspectorDrawer } from './InspectorDrawer';
import { CopilotBar } from './CopilotBar';
import { StatusBar } from './StatusBar';

export function Dashboard() {
  const loadCases = useTraceXStore((s) => s.loadCases);
  const openCase = useTraceXStore((s) => s.openCase);
  const selectedNodeId = useTraceXStore((s) => s.selectedNodeId);
  const leftSheetOpen = useTraceXStore((s) => s.leftSheetOpen);
  const setLeftSheetOpen = useTraceXStore((s) => s.setLeftSheetOpen);
  const caseMeta = useTraceXStore((s) => s.caseMeta);

  useEffect(() => {
    void loadCases();
    // Default to OP EAGLE CLAW — the flagship 15-node / 27-edge seeded case
    // (2 kingpin bridge persons + mule, 4 phones, 3 bank accounts, 2 vehicles,
    // 1 rendezvous location, 2 FIR records) so the dashboard opens on a live,
    // analytically-rich graph instead of an empty canvas. The blank "NEW
    // ANALYSIS" canvas remains in the dropdown for analysts who want to
    // upload their own FIRs/CDRs/statements and build from scratch.
    void openCase('case-eagle-claw');
  }, [loadCases, openCase]);

  // ESC clears the node selection / closes overlays
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const s = useTraceXStore.getState();
        if (s.highlightNodeIds) s.setHighlight(null);
        else if (s.selectedNodeId) s.selectNode(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-tracex-bg">
      <ClassificationBanner />
      <TopBar />

      <div className="relative flex min-h-0 flex-1">
        {/* left control panel — docked on lg+ */}
        <aside
          className="hidden w-[296px] shrink-0 flex-col overflow-hidden border-r border-slate-800/80 bg-tracex-panel lg:flex xl:w-[320px]"
          aria-label="Ingestion and filters"
        >
          <LeftPanel />
        </aside>

        {/* central fusion canvas */}
        <main className="relative min-w-0 flex-1" aria-label="Network visualizer">
          <GraphCanvas />
          <CopilotBar />
        </main>

        {/* right inspector — slide-over below xl, docked above */}
        <aside
          aria-label="Entity inspector"
          className={`absolute inset-y-0 right-0 z-20 w-[min(370px,94vw)] transform border-l border-slate-800/80 bg-tracex-panel shadow-2xl shadow-black/60 transition-transform duration-300 ease-out xl:relative xl:z-0 xl:w-[370px] xl:translate-x-0 xl:shadow-none ${
            selectedNodeId ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <InspectorDrawer />
        </aside>

        {/* mobile control panel */}
        <Sheet open={leftSheetOpen} onOpenChange={setLeftSheetOpen}>
          <SheetContent
            side="left"
            className="w-[min(340px,88vw)] border-r border-slate-800 bg-tracex-panel p-0 sm:max-w-[340px]"
          >
            <SheetHeader className="border-b border-slate-800/80 px-4 py-3">
              <SheetTitle className="font-mono text-[11px] tracking-[0.22em] text-cyan-400">
                CONTROL PANEL
              </SheetTitle>
              <SheetDescription className="font-mono text-[8.5px] tracking-[0.16em] text-slate-500">
                {caseMeta ? `${caseMeta.codename} · ${caseMeta.agency}` : 'INGESTION · FILTERS · TEMPORAL'}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-hidden">
              <LeftPanel />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* sticky status footer */}
      <StatusBar />
    </div>
  );
}

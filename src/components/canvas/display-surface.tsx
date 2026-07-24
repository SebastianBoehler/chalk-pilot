"use client";

import { PresentationCanvas } from "./presentation-canvas";
import { useDisplayReceiver } from "@/features/display/use-display-channel";

export function DisplaySurface() {
  const state = useDisplayReceiver();
  return (
    <main className="bg-background min-h-screen px-8 py-7 lg:px-12">
      <header className="mx-auto mb-8 flex max-w-6xl items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">ChalkPilot</h1>
          <p className="text-muted">Room-aware learning canvas</p>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span
            className={`size-2.5 rounded-full ${
              state.synchronized ? "bg-success" : "bg-muted"
            }`}
          />
          {state.synchronized ? state.agentState : "Waiting for controller"}
        </div>
      </header>
      <PresentationCanvas canvas={state.canvas} navigation={state.navigation} />
    </main>
  );
}

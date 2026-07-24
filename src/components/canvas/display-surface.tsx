"use client";

import { useCallback, useState } from "react";
import { PresentationCanvas } from "./presentation-canvas";
import { useDisplayReceiver } from "@/features/display/use-display-channel";

export function DisplaySurface() {
  const state = useDisplayReceiver();
  const [navigationError, setNavigationError] = useState<{
    requestId: string;
    message: string;
  } | null>(null);
  const requestId = state.navigation?.requestId;
  const onNavigationFailure = useCallback(
    (message: string) => {
      if (requestId) setNavigationError({ requestId, message });
    },
    [requestId],
  );
  const visibleError =
    navigationError && navigationError.requestId === requestId
      ? navigationError.message
      : null;

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
      {visibleError ? (
        <p
          className="text-error mx-auto mb-6 max-w-6xl text-sm"
          data-display-navigation-error
          role="alert"
        >
          {visibleError}
        </p>
      ) : null}
      <PresentationCanvas
        canvas={state.canvas}
        navigation={state.navigation}
        onNavigationFailure={onNavigationFailure}
      />
    </main>
  );
}

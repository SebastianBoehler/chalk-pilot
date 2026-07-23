"use client";

import { Button } from "@/components/ui/button";
import { ErrorPanel } from "@/components/ui/error-panel";
import { StatusPill } from "@/components/ui/status-pill";

interface ReadyStepProps {
  cameraReady: boolean;
  boardReady: boolean;
  openAiReady: boolean;
  busy: boolean;
  error?: string;
  onStart: () => void;
}

export function ReadyStep({
  cameraReady,
  boardReady,
  openAiReady,
  busy,
  error,
  onStart,
}: ReadyStepProps) {
  const ready = cameraReady && boardReady && openAiReady;
  return (
    <section aria-labelledby="ready-title" className="space-y-7">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight" id="ready-title">
          Ready for the board
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-lg">
          Starting connects your microphone to the realtime learning partner.
          Your camera video still remains local.
        </p>
      </div>

      {error && (
        <ErrorPanel
          message={error}
          title="The learning session could not start"
        />
      )}

      <div className="flex max-w-2xl flex-wrap gap-3">
        <StatusPill
          label="Room camera"
          status={cameraReady ? "ready" : "error"}
        />
        <StatusPill
          label="Board frame"
          status={boardReady ? "ready" : "error"}
        />
        <StatusPill label="OpenAI" status={openAiReady ? "ready" : "error"} />
      </div>

      <Button disabled={!ready || busy} onClick={onStart} type="button">
        {busy ? "Starting…" : "Start learning session"}
      </Button>
    </section>
  );
}

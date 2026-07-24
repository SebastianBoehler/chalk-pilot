"use client";

import { Button } from "@/components/ui/button";
import { ErrorPanel } from "@/components/ui/error-panel";
import { StatusPill } from "@/components/ui/status-pill";

interface ReadyStepProps {
  cameraReady: boolean;
  microphoneReady: boolean;
  boardReady: boolean;
  openAiReady: boolean;
  busy: boolean;
  error?: string;
  onStart: () => void;
}

export function ReadyStep({
  cameraReady,
  microphoneReady,
  boardReady,
  openAiReady,
  busy,
  error,
  onStart,
}: ReadyStepProps) {
  const ready = cameraReady && microphoneReady && boardReady && openAiReady;
  return (
    <section aria-labelledby="ready-title" className="space-y-7">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight" id="ready-title">
          Ready to learn
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-lg">
          A ready Voice service status confirms configuration only; it is not
          connected yet. Starting connects your microphone while camera video
          remains local.
        </p>
      </div>

      {error && (
        <ErrorPanel
          message={error}
          title="The learning session could not start"
        />
      )}

      <div className="flex max-w-2xl flex-wrap gap-3">
        <StatusPill label="Camera" status={cameraReady ? "ready" : "error"} />
        <StatusPill
          label="Microphone"
          status={microphoneReady ? "ready" : "error"}
        />
        <StatusPill
          label="Board frame"
          status={boardReady ? "ready" : "error"}
        />
        <StatusPill
          label="Voice service"
          status={openAiReady ? "ready" : "error"}
        />
      </div>

      <Button disabled={!ready || busy} onClick={onStart} type="button">
        {busy ? "Starting…" : "Start learning session"}
      </Button>
    </section>
  );
}

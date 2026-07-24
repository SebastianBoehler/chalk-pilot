"use client";

import { Button } from "@/components/ui/button";
import type { SessionRecording } from "@/features/recording/use-session-recording";

interface RecordingControlsProps {
  recording: SessionRecording;
}

export function RecordingControls({ recording }: RecordingControlsProps) {
  return (
    <section
      aria-labelledby="recording-title"
      className="border-border mt-5 rounded-2xl border p-4"
    >
      <h2 className="font-semibold" id="recording-title">
        Recording
      </h2>
      <p className="text-muted mt-1 text-sm leading-relaxed">
        Record one synchronized session with board, speaker, canvas, microphone,
        and desktop audio. Chrome asks you to choose the canvas display and
        include its audio.
      </p>

      <p aria-live="polite" className="mt-3 text-sm font-semibold">
        {statusLabel(recording.status)} · {formatDuration(recording.durationMs)}
      </p>

      {recording.error && (
        <p className="text-danger mt-2 text-sm">{recording.error}</p>
      )}

      {recording.canStop ? (
        <Button
          className="mt-3 w-full"
          disabled={recording.status === "stopping"}
          onClick={() => void recording.stop()}
          type="button"
          variant="danger"
        >
          {recording.status === "stopping"
            ? "Finalizing recording…"
            : "Stop recording"}
        </Button>
      ) : recording.replayUrl ? (
        <a
          className="bg-primary hover:bg-primary-hover mt-3 block rounded-xl px-5 py-3 text-center font-semibold text-white"
          href={recording.replayUrl}
        >
          Open replay
        </a>
      ) : (
        <Button
          className="mt-3 w-full"
          disabled={!recording.canStart || recording.status === "starting"}
          onClick={() => void recording.start()}
          type="button"
          variant="secondary"
        >
          {recording.status === "starting"
            ? "Choose display and audio…"
            : "Start session recording"}
        </Button>
      )}
    </section>
  );
}

function statusLabel(status: SessionRecording["status"]) {
  return (
    {
      idle: "Ready",
      starting: "Starting",
      recording: "Recording",
      stopping: "Finalizing",
      complete: "Complete",
      error: "Needs attention",
    } satisfies Record<SessionRecording["status"], string>
  )[status];
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

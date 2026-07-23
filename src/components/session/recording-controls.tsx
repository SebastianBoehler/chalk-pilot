"use client";

import { Button } from "@/components/ui/button";
import { useSessionRecording } from "@/features/recording/use-session-recording";

interface RecordingControlsProps {
  boardPreview: string | null;
  video?: HTMLVideoElement;
}

export function RecordingControls({
  boardPreview,
  video,
}: RecordingControlsProps) {
  const recording = useSessionRecording(video, boardPreview);

  return (
    <section
      aria-labelledby="recording-title"
      className="border-border mt-5 rounded-2xl border p-4"
    >
      <h2 className="font-semibold" id="recording-title">
        Recording
      </h2>
      <p className="text-muted mt-1 text-sm leading-relaxed">
        Board and speaker recording start automatically. Chrome asks only for
        the canvas: select the clean-display tab for canvas-only output, or this
        ChalkPilot tab to include the sidebar.
      </p>

      {recording.error && (
        <p className="text-danger mt-3 text-sm">{recording.error}</p>
      )}

      {recording.status === "recording" ? (
        <div className="mt-3 space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="bg-danger size-2.5 animate-pulse rounded-full" />
            Recording 3 videos
          </p>
          <Button
            className="w-full"
            onClick={() => void recording.stop()}
            type="button"
            variant="danger"
          >
            Stop recording
          </Button>
        </div>
      ) : (
        <Button
          className="mt-3 w-full"
          disabled={!recording.canStart || recording.status !== "idle"}
          onClick={() => void recording.start()}
          type="button"
          variant="secondary"
        >
          {recording.status === "starting"
            ? "Choose canvas…"
            : recording.status === "stopping"
              ? "Finishing videos…"
              : "Start 3 recordings"}
        </Button>
      )}

      {recording.downloads.length > 0 && (
        <div className="mt-3 grid gap-2">
          {recording.downloads.map((download) => (
            <a
              className="border-border hover:bg-surface-muted rounded-xl border px-4 py-2 text-center text-sm font-semibold"
              download={download.filename}
              href={download.url}
              key={download.kind}
            >
              Download {download.kind}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

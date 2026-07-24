"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PresentationCanvas } from "@/components/canvas/presentation-canvas";
import { Button } from "@/components/ui/button";
import { ErrorPanel } from "@/components/ui/error-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { playCompletionChime } from "@/features/audio/completion-chime";
import type { CanvasJobState } from "@/features/canvas-worker/client";
import type { CanvasNavigation } from "@/features/canvas-navigation/schema";
import { useResolvedCanvasNavigation } from "@/features/canvas-navigation/use-resolved-navigation";
import type { AgentState } from "@/features/display/protocol";
import type { SessionRecording } from "@/features/recording/use-session-recording";
import type { TranscriptEntry } from "@/features/session/transcript";
import type { CanvasState } from "@/features/workspace/schema";
import { RecordingControls } from "./recording-controls";
import { TranscriptPanel } from "./transcript-panel";

interface LearningWorkspaceProps {
  canvas: CanvasState;
  navigation: CanvasNavigation | null;
  canvasJobState: CanvasJobState;
  canvasJobError?: string;
  preview: string | null;
  recording: SessionRecording;
  agentState: AgentState;
  paused: boolean;
  realtimeConnected: boolean;
  displayConnected: boolean;
  boardNotice: string;
  error?: string;
  transcript: TranscriptEntry[];
  onInspect: () => void;
  onPause: () => void;
  onOpenDisplay: () => void;
  onRecalibrate: () => void;
  onEnd: () => void;
}

export function LearningWorkspace(props: LearningWorkspaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const previousCanvasJobState = useRef(props.canvasJobState);
  const resolvedNavigation = useResolvedCanvasNavigation(
    props.canvas,
    props.navigation,
  );
  const recordingBusy =
    props.recording.canStop ||
    props.recording.status === "starting" ||
    props.recording.status === "stopping";

  useEffect(() => {
    if (
      previousCanvasJobState.current === "building" &&
      props.canvasJobState === "complete"
    ) {
      playCompletionChime();
    }
    previousCanvasJobState.current = props.canvasJobState;
  }, [props.canvasJobState]);

  return (
    <div className="bg-background flex min-h-[calc(100svh-4rem)]">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/95 flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Learning canvas
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden flex-wrap gap-2 md:flex">
              <StatusPill
                label={props.agentState}
                status={props.realtimeConnected ? "ready" : "error"}
              />
              <StatusPill
                label="Board input"
                status={props.preview ? "ready" : "waiting"}
              />
              <StatusPill
                label="Canvas worker"
                status={
                  props.canvasJobState === "error"
                    ? "error"
                    : props.canvasJobState === "building"
                      ? "waiting"
                      : "ready"
                }
              />
            </div>
            <Button
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((open) => !open)}
              type="button"
              variant="secondary"
            >
              {sidebarOpen ? "Hide session controls" : "Show session controls"}
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-5 py-7 lg:px-8 lg:py-9">
          {resolvedNavigation.navigationError ? (
            <p
              className="text-danger mx-auto mb-6 max-w-6xl text-sm"
              role="alert"
            >
              {resolvedNavigation.navigationError}
            </p>
          ) : null}
          <PresentationCanvas
            canvas={props.canvas}
            navigation={resolvedNavigation.navigation}
            onNavigationFailure={resolvedNavigation.onNavigationFailure}
          />
        </div>
      </main>

      <aside
        aria-hidden={!sidebarOpen}
        className={`border-border bg-surface w-[22rem] shrink-0 border-l px-4 py-5 max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:overflow-auto max-lg:shadow-2xl ${
          sidebarOpen ? "" : "hidden"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Session controls</p>
            <p className="text-muted text-xs">Context, not the workspace</p>
          </div>
          <Button
            className="px-3 py-2 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            type="button"
            variant="quiet"
          >
            Close
          </Button>
        </div>

        {props.error && (
          <div className="mt-4">
            <ErrorPanel message={props.error} title="Session needs attention" />
          </div>
        )}

        {props.canvasJobError && (
          <div className="mt-4">
            <ErrorPanel
              message={props.canvasJobError}
              title="Canvas worker needs attention"
            />
          </div>
        )}

        {props.canvasJobState !== "idle" && !props.canvasJobError && (
          <p
            aria-live="polite"
            className="border-border bg-surface-muted mt-4 rounded-xl border px-3 py-2 text-sm"
          >
            {canvasJobMessage(props.canvasJobState)}
          </p>
        )}

        <section className="mt-5" aria-labelledby="board-input-title">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" id="board-input-title">
              Board input
            </h2>
            <span className="text-muted text-xs">
              {props.preview ? "Corrected" : "Preparing"}
            </span>
          </div>
          <div className="border-border bg-surface-muted relative mt-2 aspect-video overflow-hidden rounded-2xl border">
            {props.preview ? (
              <Image
                alt="Current corrected board"
                className="object-contain"
                fill
                sizes="352px"
                src={props.preview}
                unoptimized
              />
            ) : (
              <p className="text-muted grid h-full place-items-center px-4 text-center text-sm">
                Preparing the corrected board…
              </p>
            )}
          </div>
          <p className="text-muted mt-2 text-xs leading-relaxed">
            {props.boardNotice}
          </p>
          <div className="mt-3 grid gap-2">
            <Button
              disabled={!props.realtimeConnected || !props.preview}
              onClick={props.onInspect}
              type="button"
            >
              Inspect board now
            </Button>
            <Button onClick={props.onPause} type="button" variant="secondary">
              {props.paused ? "Resume listening" : "Pause listening"}
            </Button>
          </div>
        </section>

        <RecordingControls recording={props.recording} />

        <TranscriptPanel transcript={props.transcript} />

        <div className="mt-5 grid gap-2">
          <Button
            onClick={props.onOpenDisplay}
            type="button"
            variant="secondary"
          >
            {props.displayConnected
              ? "Reopen clean display"
              : "Open clean display"}
          </Button>
          <Button
            disabled={recordingBusy}
            onClick={props.onRecalibrate}
            type="button"
            variant="secondary"
          >
            Recalibrate board
          </Button>
          <Button
            disabled={recordingBusy}
            onClick={props.onEnd}
            type="button"
            variant="danger"
          >
            End session
          </Button>
        </div>
      </aside>
    </div>
  );
}

function canvasJobMessage(state: CanvasJobState) {
  if (state === "building") return "Building visual context…";
  if (state === "complete") return "Visual context ready.";
  return "The canvas worker needs attention.";
}

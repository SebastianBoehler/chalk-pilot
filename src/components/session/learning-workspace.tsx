"use client";

import Image from "next/image";
import { useState } from "react";
import { PresentationCanvas } from "@/components/canvas/presentation-canvas";
import { Button } from "@/components/ui/button";
import { ErrorPanel } from "@/components/ui/error-panel";
import { StatusPill } from "@/components/ui/status-pill";
import type { AgentState } from "@/features/display/protocol";
import type { TranscriptLine } from "@/features/session/transcript";
import type { CanvasState } from "@/features/workspace/schema";
import { RecordingControls } from "./recording-controls";

interface LearningWorkspaceProps {
  canvas: CanvasState;
  preview: string | null;
  video?: HTMLVideoElement;
  agentState: AgentState;
  paused: boolean;
  realtimeConnected: boolean;
  displayConnected: boolean;
  boardNotice: string;
  error?: string;
  transcript: TranscriptLine[];
  onInspect: () => void;
  onPause: () => void;
  onOpenDisplay: () => void;
  onRecalibrate: () => void;
  onEnd: () => void;
}

export function LearningWorkspace(props: LearningWorkspaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="bg-background flex min-h-screen">
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
          <PresentationCanvas canvas={props.canvas} />
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

        <RecordingControls boardPreview={props.preview} video={props.video} />

        <details className="border-border mt-5 rounded-2xl border p-4" open>
          <summary className="cursor-pointer font-semibold">
            Transcript ({props.transcript.length})
          </summary>
          <div className="mt-3 max-h-56 space-y-3 overflow-auto">
            {props.transcript.length === 0 ? (
              <p className="text-muted text-sm">No completed turns yet.</p>
            ) : (
              props.transcript.map((line) => (
                <p className="text-sm" key={line.sourceId}>
                  <strong>{line.role === "user" ? "You" : "Pilot"}:</strong>{" "}
                  {line.text}
                </p>
              ))
            )}
          </div>
        </details>

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
            onClick={props.onRecalibrate}
            type="button"
            variant="secondary"
          >
            Recalibrate board
          </Button>
          <Button onClick={props.onEnd} type="button" variant="danger">
            End session
          </Button>
        </div>
      </aside>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorPanel } from "@/components/ui/error-panel";
import { StatusPill } from "@/components/ui/status-pill";
import type { BoardController } from "@/features/board/board-controller";
import type { BoardCorners } from "@/features/board/types";
import type { AgentState } from "@/features/display/protocol";
import { ChalkPilotRealtime } from "@/features/realtime/session";
import {
  createSessionState,
  sessionReducer,
} from "@/features/session/session-machine";
import {
  persistTranscript,
  type TranscriptLine,
} from "@/features/session/transcript";
import type { CanvasState } from "@/features/workspace/schema";

interface SessionControllerProps {
  sessionId: string;
  video: HTMLVideoElement;
  board: BoardController;
  corners: BoardCorners;
  canvas: CanvasState;
  displayConnected: boolean;
  onCanvasChanged: (canvas: CanvasState) => void;
  onAgentState: (state: AgentState) => void;
  onOpenDisplay: () => void;
  onRecalibrate: () => void;
  onEnd: () => void;
}

export function SessionController(props: SessionControllerProps) {
  const { board, onAgentState, onCanvasChanged, sessionId } = props;
  const [state, dispatch] = useReducer(
    sessionReducer,
    createSessionState(sessionId),
  );
  const [preview, setPreview] = useState(board.getLatestImage());
  const [error, setError] = useState<string>();
  const [boardNotice, setBoardNotice] = useState(
    "Board images are sent only at turn boundaries.",
  );
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [diagnostic, setDiagnostic] = useState("");
  const realtimeRef = useRef<ChalkPilotRealtime | null>(null);
  const persisted = useRef(new Set<string>());

  useEffect(() => {
    dispatch(
      props.displayConnected
        ? { type: "display_connected" }
        : { type: "display_lost" },
    );
  }, [props.displayConnected]);

  useEffect(() => {
    dispatch({ type: "camera_ready" });
    const realtime = new ChalkPilotRealtime({
      sessionId,
      board,
      onCanvasChanged,
      onState: (agentState) => {
        dispatch({ type: "agent_state", state: agentState });
        onAgentState(agentState);
      },
      onError: (message) => {
        setError(message);
        dispatch({ type: "realtime_error" });
      },
      onBoardSent: () =>
        setBoardNotice("Corrected board shared with the learning partner."),
      onTranscript: (history) =>
        persistTranscript(history, sessionId, persisted.current, (lines) =>
          setTranscript(lines),
        ),
    });
    realtimeRef.current = realtime;
    void realtime
      .connect()
      .then(() => dispatch({ type: "realtime_connected" }))
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "The voice session could not connect.",
        );
        dispatch({ type: "realtime_error" });
      });
    return () => {
      realtime.close();
      realtimeRef.current = null;
    };
  }, [board, onAgentState, onCanvasChanged, sessionId]);

  useEffect(() => {
    let active = true;
    let sampling = false;
    const sample = async () => {
      if (sampling) return;
      sampling = true;
      try {
        const image = await props.board.sample(props.video, props.corners);
        if (active) setPreview(image);
      } catch (cause) {
        if (active) {
          dispatch({ type: "camera_lost" });
          setError(
            cause instanceof Error
              ? cause.message
              : "The board preview stopped.",
          );
        }
      } finally {
        sampling = false;
      }
    };
    void sample();
    const interval = window.setInterval(() => void sample(), 1_500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [props.board, props.corners, props.video]);

  const togglePause = () => {
    const paused = !state.paused;
    realtimeRef.current?.pause(paused);
    dispatch({ type: "paused", paused });
  };

  const inspect = async () => {
    setBoardNotice("Sharing the corrected board…");
    const status = await realtimeRef.current?.inspectBoardNow();
    if (status === "unavailable")
      setBoardNotice("No board frame is available.");
    if (status === "unchanged") setBoardNotice("Board re-shared on request.");
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-7 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-primary text-sm font-semibold tracking-[0.16em] uppercase">
            ChalkPilot
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Work at the board
          </h1>
          <p className="text-muted mt-2">{boardNotice}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill
            label="Camera"
            status={state.camera === "ready" ? "ready" : "error"}
          />
          <StatusPill
            label="Display"
            status={props.displayConnected ? "ready" : "error"}
          />
          <StatusPill
            label={state.agentState}
            status={
              state.realtime === "connected"
                ? "ready"
                : state.realtime === "connecting"
                  ? "waiting"
                  : "error"
            }
          />
        </div>
      </header>

      {error && (
        <div className="mt-6">
          <ErrorPanel message={error} title="Session needs attention" />
        </div>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="border-border bg-surface overflow-hidden rounded-3xl border">
          <div className="relative aspect-video bg-black">
            {preview && (
              <Image
                alt="Current corrected board"
                className="object-contain"
                fill
                sizes="(min-width: 1024px) 70vw, 100vw"
                src={preview}
                unoptimized
              />
            )}
          </div>
          <div className="flex flex-wrap gap-3 p-5">
            <Button
              disabled={!state.canSendBoard}
              onClick={() => void inspect()}
              type="button"
            >
              Inspect board now
            </Button>
            <Button onClick={togglePause} type="button" variant="secondary">
              {state.paused ? "Resume listening" : "Pause listening"}
            </Button>
          </div>
        </section>

        <aside className="space-y-4">
          {state.needsDisplayReopen && (
            <Button
              className="w-full"
              onClick={props.onOpenDisplay}
              type="button"
            >
              Reopen presentation
            </Button>
          )}
          <Button
            className="w-full"
            onClick={props.onRecalibrate}
            type="button"
            variant="secondary"
          >
            Recalibrate board
          </Button>
          <details className="border-border bg-surface rounded-2xl border p-4">
            <summary className="cursor-pointer font-semibold">
              Transcript ({transcript.length})
            </summary>
            <div className="mt-4 max-h-64 space-y-3 overflow-auto">
              {transcript.length === 0 ? (
                <p className="text-muted text-sm">No completed turns yet.</p>
              ) : (
                transcript.map((line) => (
                  <p className="text-sm" key={line.sourceId}>
                    <strong>{line.role === "user" ? "You" : "Pilot"}:</strong>{" "}
                    {line.text}
                  </p>
                ))
              )}
            </div>
          </details>
          <details className="border-border bg-surface rounded-2xl border p-4">
            <summary className="cursor-pointer font-semibold">
              Connection test
            </summary>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!diagnostic.trim()) return;
                realtimeRef.current?.sendDiagnostic(diagnostic.trim());
                setDiagnostic("");
              }}
            >
              <label className="text-muted block text-sm" htmlFor="diagnostic">
                Typed diagnostic turn
              </label>
              <input
                className="border-border w-full rounded-xl border px-3 py-2"
                id="diagnostic"
                onChange={(event) => setDiagnostic(event.target.value)}
                value={diagnostic}
              />
              <Button
                disabled={state.realtime !== "connected"}
                type="submit"
                variant="secondary"
              >
                Send test
              </Button>
            </form>
          </details>
          <Button
            className="w-full"
            onClick={props.onEnd}
            type="button"
            variant="danger"
          >
            End session
          </Button>
        </aside>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { BoardController } from "@/features/board/board-controller";
import type { BoardCorners } from "@/features/board/types";
import type { CanvasJobState } from "@/features/canvas-worker/client";
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
import { LearningWorkspace } from "./learning-workspace";

interface SessionControllerProps {
  sessionId: string;
  video: HTMLVideoElement;
  board: BoardController;
  corners: BoardCorners;
  canvas: CanvasState;
  microphone: MediaStream;
  displayConnected: boolean;
  onCanvasChanged: (canvas: CanvasState) => void;
  onAgentState: (state: AgentState) => void;
  onOpenDisplay: () => void;
  onRecalibrate: () => void;
  onEnd: () => void;
}

const BOARD_SAMPLE_INTERVAL_MS = 500;

export function SessionController(props: SessionControllerProps) {
  const { board, microphone, onAgentState, onCanvasChanged, sessionId } = props;
  const [state, dispatch] = useReducer(
    sessionReducer,
    createSessionState(sessionId),
  );
  const [preview, setPreview] = useState(board.getLatestImage());
  const [error, setError] = useState<string>();
  const [canvasJobError, setCanvasJobError] = useState<string>();
  const [canvasJobState, setCanvasJobState] = useState<CanvasJobState>("idle");
  const [boardNotice, setBoardNotice] = useState(
    "Board images are sent only at turn boundaries.",
  );
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
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
    let active = true;
    dispatch({ type: "camera_ready" });
    const realtime = new ChalkPilotRealtime({
      sessionId,
      board,
      microphone,
      onCanvasChanged,
      onState: (agentState) => {
        if (!active) return;
        dispatch({ type: "agent_state", state: agentState });
        onAgentState(agentState);
      },
      onError: (message) => {
        if (!active) return;
        setError(message);
        dispatch({ type: "realtime_error" });
      },
      onBoardSent: () => {
        if (active)
          setBoardNotice("Corrected board shared with the learning partner.");
      },
      onCanvasJobState: (jobState) => {
        if (!active) return;
        setCanvasJobState(jobState);
        if (jobState === "building") setCanvasJobError(undefined);
      },
      onCanvasJobError: (message) => {
        if (active) setCanvasJobError(message);
      },
      onTranscript: (history) => {
        if (!active) return;
        persistTranscript(history, sessionId, persisted.current, (lines) =>
          setTranscript(lines),
        );
      },
    });
    realtimeRef.current = realtime;
    void realtime
      .connect()
      .then(() => {
        if (active) dispatch({ type: "realtime_connected" });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "The voice session could not connect.",
        );
        dispatch({ type: "realtime_error" });
      });
    return () => {
      active = false;
      realtime.close();
      realtimeRef.current = null;
    };
  }, [board, microphone, onAgentState, onCanvasChanged, sessionId]);

  useEffect(() => {
    let active = true;
    let sampling = false;
    void props.video.play().catch((cause: unknown) => {
      if (!active) return;
      dispatch({ type: "camera_lost" });
      setError(
        cause instanceof Error
          ? cause.message
          : "The board camera could not resume.",
      );
    });
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
    const interval = window.setInterval(
      () => void sample(),
      BOARD_SAMPLE_INTERVAL_MS,
    );
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
    <LearningWorkspace
      agentState={state.agentState}
      boardNotice={boardNotice}
      canvas={props.canvas}
      canvasJobError={canvasJobError}
      canvasJobState={canvasJobState}
      displayConnected={props.displayConnected}
      error={error}
      onEnd={props.onEnd}
      onInspect={() => void inspect()}
      onOpenDisplay={props.onOpenDisplay}
      onPause={togglePause}
      onRecalibrate={props.onRecalibrate}
      paused={state.paused}
      preview={preview}
      realtimeConnected={state.realtime === "connected"}
      transcript={transcript}
      video={props.video}
    />
  );
}

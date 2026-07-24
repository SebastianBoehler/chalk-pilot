"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { BoardController } from "@/features/board/board-controller";
import type { BoardCorners } from "@/features/board/types";
import type { CanvasJobState } from "@/features/canvas-worker/client";
import type { CanvasNavigation } from "@/features/canvas-navigation/schema";
import type { AgentState } from "@/features/display/protocol";
import type { StudyPackOutline } from "@/features/study-pack/schema";
import type { PersonBox } from "@/features/recording/presenter-tracker";
import { useSessionRecording } from "@/features/recording/use-session-recording";
import { ChalkPilotRealtime } from "@/features/realtime/session";
import {
  createSessionState,
  sessionReducer,
} from "@/features/session/session-machine";
import {
  persistTranscript,
  type TranscriptEntry,
} from "@/features/session/transcript";
import type { CanvasState } from "@/features/workspace/schema";
import type { CameraUse } from "@/features/setup/camera-use";
import { LearningWorkspace } from "./learning-workspace";

interface SessionControllerProps {
  sessionId: string;
  video: HTMLVideoElement;
  board: BoardController;
  corners: BoardCorners;
  canvas: CanvasState;
  microphone: MediaStream;
  studyPack?: StudyPackOutline;
  cameraUse: CameraUse;
  presenter?: PersonBox;
  displayConnected: boolean;
  onCanvasChanged: (canvas: CanvasState) => void;
  navigation: CanvasNavigation | null;
  onNavigation: (navigation: CanvasNavigation) => void;
  onAgentState: (state: AgentState) => void;
  onOpenDisplay: () => void;
  onRecalibrate: () => void;
  onEnd: () => void;
}

const BOARD_SAMPLE_INTERVAL_MS = 500;

export function SessionController(props: SessionControllerProps) {
  const {
    board,
    microphone,
    onAgentState,
    onCanvasChanged,
    onNavigation,
    sessionId,
  } = props;
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
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const realtimeRef = useRef<ChalkPilotRealtime | null>(null);
  const canvasRef = useRef(props.canvas);
  // Realtime tools can run before passive effects after a canvas prop update.
  // eslint-disable-next-line react-hooks/refs
  canvasRef.current = props.canvas;
  const persisted = useRef(new Set<string>());
  const recordedNavigationIds = useRef(new Set<string>());
  const recording = useSessionRecording({
    video: props.video,
    boardPreview: preview,
    sessionId,
    microphone,
    cameraUse: props.cameraUse,
    presenter: props.presenter,
    canvas: props.canvas,
  });
  const {
    attachTranscript: attachRecordingTranscript,
    noteCueEnd,
    noteCueStart,
    noteCanvas,
    noteNavigation,
  } = recording;
  const onRealtimeCanvasChanged = useCallback(
    (canvas: CanvasState) => {
      canvasRef.current = canvas;
      onCanvasChanged(canvas);
    },
    [onCanvasChanged],
  );
  const onRealtimeNavigation = useCallback(
    (navigation: CanvasNavigation, canvas: CanvasState) => {
      if (!recordedNavigationIds.current.has(navigation.requestId)) {
        recordedNavigationIds.current.add(navigation.requestId);
        const atMs = performance.now();
        noteCanvas(canvas, atMs);
        noteNavigation(navigation, atMs);
      }
      onNavigation(navigation);
    },
    [noteCanvas, noteNavigation, onNavigation],
  );

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
      studyPack: props.studyPack,
      onCanvasChanged: onRealtimeCanvasChanged,
      getCanvas: () => canvasRef.current,
      onNavigation: onRealtimeNavigation,
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
        persistTranscript(
          history,
          sessionId,
          persisted.current,
          (lines) => setTranscript(lines),
          attachRecordingTranscript,
        );
      },
      onCueStart: noteCueStart,
      onCueEnd: noteCueEnd,
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
  }, [
    attachRecordingTranscript,
    board,
    microphone,
    noteCueEnd,
    noteCueStart,
    onAgentState,
    onRealtimeCanvasChanged,
    onRealtimeNavigation,
    props.studyPack,
    sessionId,
  ]);

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
      navigation={props.navigation}
      onOpenDisplay={props.onOpenDisplay}
      onPause={togglePause}
      onRecalibrate={props.onRecalibrate}
      paused={state.paused}
      preview={preview}
      recording={recording}
      realtimeConnected={state.realtime === "connected"}
      transcript={transcript}
    />
  );
}

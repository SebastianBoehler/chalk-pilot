"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { SessionController } from "@/components/session/session-controller";
import { Button } from "@/components/ui/button";
import {
  BoardController,
  type BoardCalibration,
} from "@/features/board/board-controller";
import { watchCalibrationDimensions } from "@/features/board/calibration-source";
import { createBoardWorkerClient } from "@/features/board/worker-client";
import type { BoardCorners } from "@/features/board/types";
import type { AgentState } from "@/features/display/protocol";
import type { PersonBox } from "@/features/recording/presenter-tracker";
import { useDisplayPublisher } from "@/features/display/use-display-channel";
import type { CanvasNavigation } from "@/features/canvas-navigation/schema";
import {
  initialSetupState,
  setupReady,
  setupReducer,
} from "@/features/setup/setup-machine";
import { stopMicrophone } from "@/features/audio/microphone";
import {
  canvasStateSchema,
  sessionRecordSchema,
  type CanvasState,
} from "@/features/workspace/schema";
import { CameraStep } from "./camera-step";
import { SetupShell } from "./setup-shell";
import { SetupStage } from "./setup-stage";
import { useRoomDisplay } from "./use-room-display";

const EMPTY_CANVAS: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};

export function SetupFlow() {
  const [setup, dispatch] = useReducer(setupReducer, initialSetupState);
  const board = useMemo(
    () =>
      typeof Worker === "undefined"
        ? undefined
        : new BoardController(createBoardWorkerClient()),
    [],
  );
  const [video, setVideo] = useState<HTMLVideoElement>();
  const [cameraStream, setCameraStream] = useState<MediaStream>();
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream>();
  const [calibration, setCalibration] = useState<BoardCalibration>();
  const [presenter, setPresenter] = useState<PersonBox>();
  const [calibrationStatus, setCalibrationStatus] = useState<
    "detecting" | "ready" | "error"
  >("detecting");
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const [mode, setMode] = useState<"setup" | "session">("setup");
  const [canvas, setCanvas] = useState(EMPTY_CANVAS);
  const [navigation, setNavigation] = useState<CanvasNavigation | null>(null);
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const calibrationRequest = useRef(0);
  const snapshot = useMemo(
    () => ({ canvas, agentState }),
    [agentState, canvas],
  );
  const { readySignal } = useDisplayPublisher(snapshot);
  const openDisplay = useRoomDisplay(readySignal, dispatch);

  useEffect(() => () => board?.dispose(), [board]);
  useEffect(() => () => stopMicrophone(microphoneStream), [microphoneStream]);

  useEffect(() => {
    void fetch("/api/realtime-token")
      .then(async (response) => {
        const result = (await response.json()) as { configured?: boolean };
        dispatch({
          type: result.configured ? "openai_ready" : "openai_error",
        });
      })
      .catch(() => dispatch({ type: "openai_error" }));
  }, []);

  const detectBoard = useCallback(async () => {
    if (!board || !video) return;
    const request = ++calibrationRequest.current;
    setCalibrationStatus("detecting");
    setError(undefined);
    try {
      const result = await board.detect(video);
      if (request !== calibrationRequest.current) return;
      setCalibration(result);
      setCalibrationStatus("ready");
    } catch (cause) {
      if (request !== calibrationRequest.current) return;
      setCalibrationStatus("error");
      setError(
        cause instanceof Error ? cause.message : "Board detection failed.",
      );
    }
  }, [board, video]);

  useEffect(() => {
    if (!video || !calibration) return;
    return watchCalibrationDimensions(video, calibration, () => {
      setCalibration(undefined);
      setPresenter(undefined);
      dispatch({ type: "recalibrate" });
      setMode("setup");
      window.history.replaceState({}, "", "/setup");
      void detectBoard();
    });
  }, [calibration, detectBoard, video]);

  const adjustCorners = (corners: BoardCorners) => {
    if (!board || !calibration) return;
    const request = ++calibrationRequest.current;
    setCalibration({ ...calibration, corners });
    setCalibrationStatus("detecting");
    void board
      .updateCorners(corners)
      .then((rectifiedUrl) => {
        if (request !== calibrationRequest.current) return;
        setCalibration((current) =>
          current ? { ...current, corners, rectifiedUrl } : current,
        );
        setCalibrationStatus("ready");
      })
      .catch((cause: unknown) => {
        if (request !== calibrationRequest.current) return;
        setCalibrationStatus("error");
        setError(cause instanceof Error ? cause.message : "Warp failed.");
      });
  };

  const confirmCalibration = () => {
    dispatch({ type: "calibration_confirmed" });
    dispatch({ type: "advance" });
  };

  const startSession = async () => {
    if (!setupReady(setup)) return;
    setStarting(true);
    setError(undefined);
    try {
      const response = await fetch("/api/sessions", { method: "POST" });
      if (!response.ok) throw new Error("Local session creation failed.");
      const session = sessionRecordSchema.parse(await response.json());
      const canvasResponse = await fetch(`/api/sessions/${session.id}/canvas`);
      setCanvas(canvasStateSchema.parse(await canvasResponse.json()));
      setSessionId(session.id);
      setMode("session");
      window.history.replaceState({}, "", "/session");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The session could not start.",
      );
    } finally {
      setStarting(false);
    }
  };

  const showCamera = mode === "setup" && setup.step === "camera";

  return (
    <>
      <div
        aria-hidden={!showCamera}
        className={
          showCamera
            ? ""
            : "pointer-events-none fixed inset-0 -z-10 size-px overflow-hidden opacity-0"
        }
      >
        <SetupShell>
          <CameraStep
            onPresenterTrackingChange={(enabled) => {
              setPresenter(undefined);
              dispatch({
                type: "camera_use_selected",
                cameraUse: enabled ? "room-wide" : "board-focused",
              });
            }}
            onReady={(readyVideo, readyStream) => {
              setVideo(readyVideo);
              setCameraStream(readyStream);
              dispatch({ type: "camera_ready" });
            }}
            presenterTracking={setup.cameraUse === "room-wide"}
          />
          {setup.camera === "ready" && (
            <Button
              className="mt-6"
              onClick={() => dispatch({ type: "advance" })}
              type="button"
            >
              Continue
            </Button>
          )}
        </SetupShell>
      </div>

      {mode === "setup" && setup.step !== "camera" && (
        <SetupStage
          board={board}
          calibration={calibration}
          calibrationStatus={calibrationStatus}
          cameraStream={cameraStream}
          error={error}
          onCalibrationConfirm={confirmCalibration}
          onCornersChange={adjustCorners}
          onDetectBoard={() => void detectBoard()}
          onMicrophoneConfirm={(stream) => {
            setMicrophoneStream(stream);
            dispatch({ type: "microphone_confirmed" });
            dispatch({ type: "advance" });
            void detectBoard();
          }}
          onPreviewBack={() => {
            setPresenter(undefined);
            dispatch({ type: "back" });
          }}
          onPreviewContinue={(confirmedPresenter) => {
            setPresenter(confirmedPresenter);
            if (sessionId) {
              setMode("session");
              window.history.replaceState({}, "", "/session");
            } else {
              dispatch({ type: "advance" });
            }
          }}
          onStart={() => void startSession()}
          setup={setup}
          starting={starting}
          video={video}
        />
      )}

      {mode === "session" &&
        sessionId &&
        video &&
        board &&
        calibration &&
        microphoneStream &&
        (setup.cameraUse === "board-focused" || presenter) && (
          <SessionController
            board={board}
            cameraUse={setup.cameraUse}
            canvas={canvas}
            corners={calibration.corners}
            displayConnected={setup.display === "connected"}
            microphone={microphoneStream}
            presenter={presenter}
            onAgentState={setAgentState}
            onCanvasChanged={setCanvas}
            navigation={navigation}
            onNavigation={setNavigation}
            onEnd={() => window.location.assign("/setup")}
            onOpenDisplay={openDisplay}
            onRecalibrate={() => {
              dispatch({ type: "recalibrate" });
              setCalibration(undefined);
              setPresenter(undefined);
              setMode("setup");
              window.history.replaceState({}, "", "/setup");
              void detectBoard();
            }}
            sessionId={sessionId}
            video={video}
          />
        )}
    </>
  );
}

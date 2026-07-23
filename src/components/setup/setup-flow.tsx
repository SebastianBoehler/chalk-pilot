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
import { ErrorPanel } from "@/components/ui/error-panel";
import {
  BoardController,
  type BoardCalibration,
} from "@/features/board/board-controller";
import { createBoardWorkerClient } from "@/features/board/worker-client";
import type { BoardCorners } from "@/features/board/types";
import type { AgentState } from "@/features/display/protocol";
import { useDisplayPublisher } from "@/features/display/use-display-channel";
import {
  initialSetupState,
  setupReady,
  setupReducer,
} from "@/features/setup/setup-machine";
import {
  canvasStateSchema,
  sessionRecordSchema,
  type CanvasState,
} from "@/features/workspace/schema";
import { CalibrationStep } from "./calibration-step";
import { CameraStep } from "./camera-step";
import { OutputPreviewStep } from "./output-preview-step";
import { ReadyStep } from "./ready-step";
import { SetupShell } from "./setup-shell";

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
  const [calibration, setCalibration] = useState<BoardCalibration>();
  const [calibrationStatus, setCalibrationStatus] = useState<
    "detecting" | "ready" | "error"
  >("detecting");
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const [mode, setMode] = useState<"setup" | "session">("setup");
  const [canvas, setCanvas] = useState(EMPTY_CANVAS);
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const displayWindow = useRef<Window | null>(null);
  const calibrationRequest = useRef(0);
  const snapshot = useMemo(
    () => ({ canvas, agentState }),
    [agentState, canvas],
  );
  const { readySignal } = useDisplayPublisher(snapshot);

  useEffect(() => () => board?.dispose(), [board]);

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

  useEffect(() => {
    if (readySignal > 0) {
      dispatch({ type: "display_connected" });
    }
  }, [readySignal]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (displayWindow.current?.closed) {
        displayWindow.current = null;
        dispatch({ type: "display_lost" });
      }
    }, 1_000);
    return () => window.clearInterval(interval);
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

  const openDisplay = () => {
    const popup = window.open(
      "/display",
      "chalkpilot-display",
      "popup,width=1440,height=900",
    );
    if (!popup) {
      window.alert(
        "Allow pop-ups for this site, then open the clean display again.",
      );
      return;
    }
    displayWindow.current = popup;
    popup.focus();
  };

  const confirmCalibration = () => {
    dispatch({ type: "calibration_confirmed" });
    if (sessionId) {
      setMode("session");
      window.history.replaceState({}, "", "/session");
    } else {
      dispatch({ type: "advance" });
    }
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
            onReady={(readyVideo, readyStream) => {
              setVideo(readyVideo);
              setCameraStream(readyStream);
              dispatch({ type: "camera_ready" });
            }}
          />
          {setup.camera === "ready" && (
            <Button
              className="mt-6"
              onClick={() => {
                dispatch({ type: "advance" });
                void detectBoard();
              }}
              type="button"
            >
              Continue
            </Button>
          )}
        </SetupShell>
      </div>

      {mode === "setup" && setup.step !== "camera" && (
        <SetupShell>
          {setup.step === "calibration" && (
            <>
              {error && !calibration && (
                <ErrorPanel
                  actionLabel="Try detection again"
                  message={error}
                  onAction={() => void detectBoard()}
                  title="Board processing needs attention"
                />
              )}
              {calibration && (
                <>
                  {!calibration.autoDetected && (
                    <p className="text-muted mb-4 text-sm">
                      No clear rectangle was found. Position the four visible
                      handles manually, then confirm the corrected preview.
                    </p>
                  )}
                  <CalibrationStep
                    corners={calibration.corners}
                    onConfirm={confirmCalibration}
                    onCornersChange={adjustCorners}
                    onDetect={() => void detectBoard()}
                    rectifiedUrl={calibration.rectifiedUrl}
                    sourceSize={calibration.sourceSize}
                    sourceUrl={calibration.sourceUrl}
                    status={calibrationStatus}
                  />
                </>
              )}
            </>
          )}
          {setup.step === "preview" &&
            board &&
            video &&
            cameraStream &&
            calibration && (
              <OutputPreviewStep
                board={board}
                corners={calibration.corners}
                onBack={() => dispatch({ type: "back" })}
                onContinue={() => dispatch({ type: "advance" })}
                sourceStream={cameraStream}
                sourceVideo={video}
              />
            )}
          {setup.step === "ready" && (
            <ReadyStep
              boardReady={setup.calibration === "confirmed"}
              busy={starting}
              cameraReady={setup.camera === "ready"}
              error={error}
              onStart={() => void startSession()}
              openAiReady={setup.openai === "ready"}
            />
          )}
        </SetupShell>
      )}

      {mode === "session" && sessionId && video && board && calibration && (
        <SessionController
          board={board}
          canvas={canvas}
          corners={calibration.corners}
          displayConnected={setup.display === "connected"}
          onAgentState={setAgentState}
          onCanvasChanged={setCanvas}
          onEnd={() => window.location.assign("/setup")}
          onOpenDisplay={openDisplay}
          onRecalibrate={() => {
            dispatch({ type: "recalibrate" });
            setCalibration(undefined);
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

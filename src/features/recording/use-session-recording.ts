"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraUse } from "@/features/setup/camera-use";
import type { TranscriptLine } from "@/features/session/transcript";
import type { CanvasState } from "@/features/workspace/schema";
import {
  createDerivedVideoStreams,
  type DerivedVideoStreams,
} from "./derived-video-streams";
import type { PersonBox } from "./presenter-tracker";
import {
  RecordingCoordinator,
  type RecordingCoordinatorStatus,
} from "./recording-coordinator";
import { RecordingTimeline } from "./recording-timeline";

export interface SessionRecordingOptions {
  video: HTMLVideoElement | undefined;
  boardPreview: string | null;
  sessionId: string;
  microphone: MediaStream;
  cameraUse: CameraUse;
  presenter?: PersonBox;
  canvas: CanvasState;
}

export interface SessionRecording {
  canStart: boolean;
  canStop: boolean;
  durationMs: number;
  error?: string;
  replayUrl?: string;
  status: RecordingCoordinatorStatus;
  start(): Promise<void>;
  stop(): Promise<void>;
  noteCueStart(speaker: "user" | "assistant", atMs: number): void;
  noteCueEnd(speaker: "user" | "assistant", atMs: number): void;
  attachTranscript(line: TranscriptLine): void;
  noteCanvas(canvas: CanvasState, atMs: number): void;
}

export function useSessionRecording(
  options: SessionRecordingOptions,
): SessionRecording {
  const [status, setStatus] = useState<RecordingCoordinatorStatus>("idle");
  const [canStop, setCanStop] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string>();
  const [replayUrl, setReplayUrl] = useState<string>();
  const coordinator = useRef<RecordingCoordinator | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const derived = useRef<DerivedVideoStreams | null>(null);
  const timeline = useRef<RecordingTimeline | null>(null);
  const durationTimer = useRef<number | undefined>(undefined);
  const stopping = useRef(false);
  const cleanupActive = useCallback(() => {
    unsubscribe.current?.();
    unsubscribe.current = null;
    window.clearInterval(durationTimer.current);
    derived.current?.stop();
    derived.current = null;
    coordinator.current = null;
    timeline.current = null;
  }, []);

  useEffect(() => {
    if (options.boardPreview) {
      void derived.current?.updateBoard(options.boardPreview);
    }
  }, [options.boardPreview]);

  useEffect(() => {
    timeline.current?.noteCanvas(options.canvas, performance.now());
  }, [options.canvas]);

  useEffect(
    () => () => {
      unsubscribe.current?.();
      window.clearInterval(durationTimer.current);
      const activeCoordinator = coordinator.current;
      const activeTimeline = timeline.current;
      if (activeCoordinator && !stopping.current) {
        activeTimeline?.closeOpenCues(performance.now());
        void activeCoordinator
          .stop(() => sealAndDrain(activeTimeline))
          .catch(() => undefined)
          .finally(() => derived.current?.stop());
      } else {
        derived.current?.stop();
      }
    },
    [],
  );

  const start = useCallback(async () => {
    if (!canStart(options) || coordinator.current) return;
    setStatus("starting");
    setError(undefined);
    setReplayUrl(undefined);
    setDurationMs(0);
    const nextDerived = createDerivedVideoStreams(options.video!, {
      cameraUse: options.cameraUse,
      onTrackingError: (message) => setError(`Presenter tracking: ${message}`),
      presenter: options.presenter ?? null,
    });
    derived.current = nextDerived;
    void nextDerived.updateBoard(options.boardPreview!);
    const nextCoordinator = new RecordingCoordinator();
    coordinator.current = nextCoordinator;
    const syncCoordinator = () => {
      setStatus(nextCoordinator.status);
      setError(nextCoordinator.error?.message);
    };
    unsubscribe.current = nextCoordinator.subscribe(syncCoordinator);
    try {
      await nextCoordinator.start({
        sessionId: options.sessionId,
        board: nextDerived.board,
        speaker: nextDerived.speaker,
        microphone: options.microphone,
      });
      const epoch = nextCoordinator.recordingEpochMs;
      if (epoch === null) throw new Error("The recording clock did not start.");
      const nextTimeline = new RecordingTimeline((event) =>
        nextCoordinator.appendTimeline(event),
      );
      nextTimeline.start(epoch);
      nextTimeline.noteCanvas(options.canvas, epoch);
      timeline.current = nextTimeline;
      durationTimer.current = window.setInterval(
        () => setDurationMs(Math.max(0, performance.now() - epoch)),
        500,
      );
      setCanStop(true);
      setStatus("recording");
    } catch (cause) {
      cleanupActive();
      if (nextCoordinator.status === "idle") {
        setStatus("idle");
        setError(undefined);
      } else {
        setStatus("error");
        setError(recordingError(cause));
      }
    }
  }, [cleanupActive, options]);

  const stop = useCallback(async () => {
    const activeCoordinator = coordinator.current;
    if (!activeCoordinator || stopping.current) return;
    stopping.current = true;
    const activeTimeline = timeline.current;
    setStatus("stopping");
    setError(undefined);
    window.clearInterval(durationTimer.current);
    activeTimeline?.closeOpenCues(performance.now());
    try {
      const manifest = await activeCoordinator.stop(() =>
        sealAndDrain(activeTimeline),
      );
      activeTimeline?.finish();
      setDurationMs(manifest.durationMs);
      setReplayUrl(activeCoordinator.replayUrl ?? undefined);
      setStatus("complete");
    } catch (cause) {
      setStatus("error");
      setError(recordingError(cause));
    } finally {
      cleanupActive();
      stopping.current = false;
      setCanStop(false);
    }
  }, [cleanupActive]);

  const noteCueStart = useCallback(
    (speaker: "user" | "assistant", atMs: number) =>
      timeline.current?.noteCueStart(speaker, atMs),
    [],
  );
  const noteCueEnd = useCallback(
    (speaker: "user" | "assistant", atMs: number) =>
      timeline.current?.noteCueEnd(speaker, atMs),
    [],
  );
  const attachTranscript = useCallback(
    (line: TranscriptLine) => timeline.current?.attachTranscript(line),
    [],
  );
  const noteCanvas = useCallback(
    (canvas: CanvasState, atMs: number) =>
      timeline.current?.noteCanvas(canvas, atMs),
    [],
  );

  return {
    canStart: canStart(options),
    canStop,
    durationMs,
    error,
    replayUrl,
    start,
    status,
    stop,
    noteCueStart,
    noteCueEnd,
    attachTranscript,
    noteCanvas,
  };
}

function canStart(options: SessionRecordingOptions) {
  return Boolean(
    options.video &&
    options.boardPreview &&
    options.sessionId &&
    options.microphone &&
    options.cameraUse &&
    (options.cameraUse === "board-focused" || options.presenter),
  );
}

function recordingError(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (
    cause &&
    typeof cause === "object" &&
    "message" in cause &&
    typeof cause.message === "string"
  ) {
    return cause.message;
  }
  return "Recording could not start.";
}

function sealAndDrain(timeline: RecordingTimeline | null) {
  timeline?.seal();
  return timeline?.drain() ?? Promise.resolve();
}

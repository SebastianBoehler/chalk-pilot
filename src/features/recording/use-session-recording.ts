"use client";

import { useEffect, useRef, useState } from "react";
import {
  createDerivedVideoStreams,
  type DerivedVideoStreams,
} from "./derived-video-streams";
import {
  RecordingCoordinator,
  type RecordingCoordinatorStatus,
} from "./recording-coordinator";

export interface RecordingDownload {
  kind: "board" | "speaker" | "canvas" | "microphone" | "desktop-audio";
  filename: string;
  url: string;
}

export function useSessionRecording(
  video: HTMLVideoElement | undefined,
  boardPreview: string | null,
  sessionId?: string,
  microphone?: MediaStream,
) {
  const [status, setStatus] = useState<RecordingCoordinatorStatus>("idle");
  const [canStop, setCanStop] = useState(false);
  const [error, setError] = useState<string>();
  const [replayUrl, setReplayUrl] = useState<string>();
  const coordinator = useRef<RecordingCoordinator | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const derived = useRef<DerivedVideoStreams | null>(null);

  useEffect(() => {
    if (boardPreview) void derived.current?.updateBoard(boardPreview);
  }, [boardPreview]);

  useEffect(
    () => () => {
      unsubscribe.current?.();
      void coordinator.current?.stop().catch(() => undefined);
      derived.current?.stop();
    },
    [],
  );

  const start = async () => {
    if (!video || !boardPreview || !sessionId || !microphone) return;
    setStatus("starting");
    setError(undefined);
    setReplayUrl(undefined);
    const nextDerived = createDerivedVideoStreams(video);
    derived.current = nextDerived;
    void nextDerived.updateBoard(boardPreview);
    const nextCoordinator = new RecordingCoordinator();
    coordinator.current = nextCoordinator;
    const syncCoordinator = () => {
      setStatus(nextCoordinator.status);
      setError(nextCoordinator.error?.message);
    };
    unsubscribe.current = nextCoordinator.subscribe(syncCoordinator);
    try {
      await nextCoordinator.start({
        sessionId,
        board: nextDerived.board,
        speaker: nextDerived.speaker,
        microphone,
      });
      setCanStop(true);
      setStatus("recording");
    } catch (cause) {
      unsubscribe.current?.();
      unsubscribe.current = null;
      nextDerived.stop();
      derived.current = null;
      coordinator.current = null;
      setCanStop(false);
      if (nextCoordinator.status === "idle") {
        setStatus("idle");
        setError(undefined);
      } else {
        setStatus("error");
        setError(recordingError(cause));
      }
    }
  };

  const stop = async () => {
    if (!coordinator.current) return;
    setStatus("stopping");
    setError(undefined);
    try {
      await coordinator.current.stop();
      setReplayUrl(coordinator.current.replayUrl ?? undefined);
      setStatus("complete");
    } catch (cause) {
      setStatus("error");
      setError(recordingError(cause));
    } finally {
      unsubscribe.current?.();
      unsubscribe.current = null;
      derived.current?.stop();
      derived.current = null;
      coordinator.current = null;
      setCanStop(false);
    }
  };

  return {
    canStart: Boolean(video && boardPreview && sessionId && microphone),
    canStop,
    downloads: [] as RecordingDownload[],
    error,
    replayUrl,
    start,
    status,
    stop,
  };
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

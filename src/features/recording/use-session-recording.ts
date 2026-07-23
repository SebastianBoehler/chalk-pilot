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
  const [error, setError] = useState<string>();
  const [replayUrl, setReplayUrl] = useState<string>();
  const coordinator = useRef<RecordingCoordinator | null>(null);
  const derived = useRef<DerivedVideoStreams | null>(null);

  useEffect(() => {
    if (boardPreview) void derived.current?.updateBoard(boardPreview);
  }, [boardPreview]);

  useEffect(
    () => () => {
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
    try {
      await nextCoordinator.start({
        sessionId,
        board: nextDerived.board,
        speaker: nextDerived.speaker,
        microphone,
      });
      setStatus("recording");
    } catch (cause) {
      nextDerived.stop();
      derived.current = null;
      coordinator.current = null;
      setStatus("error");
      setError(recordingError(cause));
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
      derived.current?.stop();
      derived.current = null;
      coordinator.current = null;
    }
  };

  return {
    canStart: Boolean(video && boardPreview && sessionId && microphone),
    downloads: [] as RecordingDownload[],
    error,
    replayUrl,
    start,
    status,
    stop,
  };
}

function recordingError(cause: unknown) {
  if (cause instanceof DOMException && cause.name === "NotAllowedError") {
    return "Canvas capture was cancelled. Start again and select the clean-display tab or this ChalkPilot tab.";
  }
  return cause instanceof Error ? cause.message : "Recording could not start.";
}

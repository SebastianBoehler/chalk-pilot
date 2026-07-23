"use client";

import { useEffect, useRef, useState } from "react";
import {
  createDerivedVideoStreams,
  type DerivedVideoStreams,
} from "./derived-video-streams";
import { SessionRecorder, type SessionRecordings } from "./session-recorder";

export interface RecordingDownload {
  kind: keyof SessionRecordings;
  filename: string;
  url: string;
}

export function useSessionRecording(
  video: HTMLVideoElement | undefined,
  boardPreview: string | null,
) {
  const [status, setStatus] = useState<
    "idle" | "starting" | "recording" | "stopping"
  >("idle");
  const [error, setError] = useState<string>();
  const [downloads, setDownloads] = useState<RecordingDownload[]>([]);
  const recorder = useRef<SessionRecorder | null>(null);
  const derived = useRef<DerivedVideoStreams | null>(null);

  useEffect(() => {
    if (boardPreview) void derived.current?.updateBoard(boardPreview);
  }, [boardPreview]);

  useEffect(
    () => () => {
      void recorder.current?.stop().catch(() => undefined);
      derived.current?.stop();
    },
    [],
  );

  useEffect(
    () => () => {
      downloads.forEach(({ url }) => URL.revokeObjectURL(url));
    },
    [downloads],
  );

  const start = async () => {
    if (!video || !boardPreview) return;
    setStatus("starting");
    setError(undefined);
    downloads.forEach(({ url }) => URL.revokeObjectURL(url));
    setDownloads([]);
    const nextDerived = createDerivedVideoStreams(video);
    derived.current = nextDerived;
    void nextDerived.updateBoard(boardPreview);
    const nextRecorder = new SessionRecorder();
    recorder.current = nextRecorder;
    try {
      await nextRecorder.start({
        board: nextDerived.board,
        speaker: nextDerived.speaker,
      });
      setStatus("recording");
    } catch (cause) {
      nextDerived.stop();
      derived.current = null;
      recorder.current = null;
      setStatus("idle");
      setError(recordingError(cause));
    }
  };

  const stop = async () => {
    if (!recorder.current) return;
    setStatus("stopping");
    setError(undefined);
    try {
      const recordings = await recorder.current.stop();
      setDownloads(
        (Object.keys(recordings) as Array<keyof SessionRecordings>).map(
          (kind) => ({
            kind,
            filename: recordings[kind].filename,
            url: URL.createObjectURL(recordings[kind].blob),
          }),
        ),
      );
    } catch (cause) {
      setError(recordingError(cause));
    } finally {
      derived.current?.stop();
      derived.current = null;
      recorder.current = null;
      setStatus("idle");
    }
  };

  return {
    canStart: Boolean(video && boardPreview),
    downloads,
    error,
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

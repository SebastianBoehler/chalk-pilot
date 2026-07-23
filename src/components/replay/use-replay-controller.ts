"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TRACK_KINDS,
  type RecordingManifest,
  type TrackKind,
} from "@/features/recording/schema";
import {
  createReplaySynchronizer,
  type ReplaySynchronizer,
} from "@/features/replay/synchronizer";

type MediaElements = Partial<Record<TrackKind, HTMLMediaElement>>;

export function useReplayController(
  manifest: RecordingManifest,
  leaderKind: TrackKind | undefined,
) {
  const [elements, setElements] = useState<MediaElements>({});
  const [currentMs, setCurrentMs] = useState(0);
  const [error, setError] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const synchronizer = useRef<ReplaySynchronizer | undefined>(undefined);
  const register = useCallback(
    (kind: TrackKind, element: HTMLMediaElement | null) => {
      setElements((current) => {
        if (current[kind] === element || (!element && !current[kind]))
          return current;
        const next = { ...current };
        if (element) next[kind] = element;
        else delete next[kind];
        return next;
      });
    },
    [],
  );
  const refs = useMemo(
    () =>
      Object.fromEntries(
        TRACK_KINDS.map((kind) => [
          kind,
          (element: HTMLMediaElement | null) => register(kind, element),
        ]),
      ) as Record<TrackKind, (element: HTMLMediaElement | null) => void>,
    [register],
  );
  const leader = leaderKind ? elements[leaderKind] : undefined;

  useEffect(() => {
    if (!leader) return;
    const followers = Object.values(elements).filter(
      (element) => element !== leader,
    );
    if (synchronizer.current) {
      synchronizer.current.setLeader(leader, followers);
    } else {
      synchronizer.current = createReplaySynchronizer(leader, followers, {
        onError: setError,
      });
    }
  }, [elements, leader]);

  useEffect(() => {
    if (!leader) return;
    const updateTime = () => setCurrentMs(leader.currentTime * 1_000);
    const updatePlaying = () => setPlaying(!leader.paused);
    leader.addEventListener("timeupdate", updateTime);
    leader.addEventListener("play", updatePlaying);
    leader.addEventListener("pause", updatePlaying);
    updateTime();
    updatePlaying();
    return () => {
      leader.removeEventListener("timeupdate", updateTime);
      leader.removeEventListener("play", updatePlaying);
      leader.removeEventListener("pause", updatePlaying);
    };
  }, [leader]);

  useEffect(
    () => () => {
      synchronizer.current?.destroy();
      synchronizer.current = undefined;
    },
    [],
  );

  const seek = useCallback(
    (nextMs: number) => {
      if (!leader) return;
      const time = Math.max(0, Math.min(nextMs, manifest.durationMs) / 1_000);
      seekMedia(leader, time);
      setCurrentMs(time * 1_000);
    },
    [leader, manifest.durationMs],
  );
  const togglePlayback = useCallback(() => {
    if (!leader) return;
    if (leader.paused) {
      void leader.play().catch((cause: unknown) => {
        setError(
          `Replay could not start: ${
            cause instanceof Error ? cause.message : "unknown media error"
          }`,
        );
      });
    } else leader.pause();
  }, [leader]);

  return {
    currentMs,
    elements,
    error,
    hasLeader: Boolean(leader),
    playing,
    refs,
    seek,
    togglePlayback,
  };
}

function seekMedia(element: HTMLMediaElement, time: number) {
  element.currentTime = time;
  element.dispatchEvent(new Event("seeking"));
}

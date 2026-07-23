"use client";

import { useEffect, useMemo, useState } from "react";
import { ReplayClient, type ReplayClientPort } from "@/features/replay/client";
import type {
  RecordingManifest,
  ReplayTimeline,
} from "@/features/recording/schema";
import { ReplayPlayer } from "./replay-player";

interface ReplayData {
  manifest: RecordingManifest;
  timeline: ReplayTimeline;
}

export function ReplaySessionLoader({
  sessionId,
  client: providedClient,
}: {
  sessionId: string;
  client?: ReplayClientPort;
}) {
  const client = useMemo(
    () => providedClient ?? new ReplayClient(),
    [providedClient],
  );
  const [data, setData] = useState<ReplayData>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void Promise.all([client.manifest(sessionId), client.timeline(sessionId)])
      .then(([manifest, timeline]) => {
        if (active) setData({ manifest, timeline });
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "This replay could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, [client, sessionId]);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p
          className="border-danger/30 bg-surface text-danger max-w-xl rounded-2xl border p-6"
          role="alert"
        >
          {error}
        </p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-muted">Loading replay…</p>
      </main>
    );
  }
  return <ReplayPlayer manifest={data.manifest} timeline={data.timeline} />;
}

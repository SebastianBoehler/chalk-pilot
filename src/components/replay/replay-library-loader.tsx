"use client";

import { useEffect, useMemo, useState } from "react";
import { ReplayClient, type ReplayClientPort } from "@/features/replay/client";
import type { RecordingSummary } from "@/features/recording/schema";
import { ReplayLibrary } from "./replay-library";

export function ReplayLibraryLoader({
  client: providedClient,
}: {
  client?: ReplayClientPort;
}) {
  const client = useMemo(
    () => providedClient ?? new ReplayClient(),
    [providedClient],
  );
  const [summaries, setSummaries] = useState<RecordingSummary[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void client
      .list()
      .then((value) => {
        if (active) setSummaries(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [client]);

  if (!summaries && !error) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-muted">Loading recordings…</p>
      </main>
    );
  }
  return <ReplayLibrary error={error} summaries={summaries ?? []} />;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "Replay Studio could not load the recordings.";
}

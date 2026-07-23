"use client";

import { Button } from "@/components/ui/button";
import { ErrorPanel } from "@/components/ui/error-panel";
import { StatusPill } from "@/components/ui/status-pill";

interface DisplayStepProps {
  connected: boolean;
  error?: string;
  onOpen: () => void;
  onContinue: () => void;
}

export function DisplayStep({
  connected,
  error,
  onOpen,
  onContinue,
}: DisplayStepProps) {
  return (
    <section aria-labelledby="display-title" className="space-y-7">
      <div>
        <h1
          className="text-4xl font-semibold tracking-tight"
          id="display-title"
        >
          Open the learning canvas
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-lg">
          A clean presentation window will open. Move it to the room display and
          make it fullscreen—there is no monitor picker to configure.
        </p>
      </div>

      {error && (
        <ErrorPanel
          actionLabel="Try opening again"
          message={error}
          onAction={onOpen}
          title="Display window blocked"
        />
      )}

      <div className="border-border bg-surface rounded-3xl border p-6">
        <StatusPill
          label={connected ? "Canvas connected" : "Waiting for canvas"}
          status={connected ? "ready" : "waiting"}
        />
        <ol className="text-muted mt-5 list-decimal space-y-2 pl-5">
          <li>Open the presentation window.</li>
          <li>Move it to the lecture-room display.</li>
          <li>Use the browser&apos;s fullscreen command.</li>
        </ol>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onOpen} type="button" variant="secondary">
          {connected ? "Reopen canvas" : "Open presentation window"}
        </Button>
        <Button disabled={!connected} onClick={onContinue} type="button">
          Continue
        </Button>
      </div>
    </section>
  );
}

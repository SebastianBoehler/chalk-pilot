"use client";

import type { RefCallback } from "react";
import type { TrackKind } from "@/features/recording/schema";

export type ReplayVideoKind = Extract<
  TrackKind,
  "board" | "speaker" | "canvas"
>;

export function ReplayMediaStage({
  available,
  primary,
  pictureInPicture,
  refs,
  sourceFor,
  onPrimary,
  onPictureInPicture,
}: {
  available: ReplayVideoKind[];
  primary?: ReplayVideoKind;
  pictureInPicture?: ReplayVideoKind;
  refs: Record<TrackKind, RefCallback<HTMLMediaElement>>;
  sourceFor(kind: TrackKind): string;
  onPrimary(kind: ReplayVideoKind): void;
  onPictureInPicture(kind?: ReplayVideoKind): void;
}) {
  return (
    <section
      aria-label="Recorded views"
      className="flex min-h-0 flex-1 flex-col"
    >
      {available.length ? (
        <>
          <div className="bg-foreground relative aspect-video min-h-64 overflow-hidden rounded-2xl shadow-sm lg:aspect-auto lg:min-h-0 lg:flex-1">
            {available.map((kind) => (
              <video
                className={videoClass(kind, primary, pictureInPicture)}
                data-testid={`track-${kind}`}
                key={kind}
                playsInline
                preload="metadata"
                ref={refs[kind] as RefCallback<HTMLVideoElement>}
                src={sourceFor(kind)}
              />
            ))}
          </div>
          <div className="border-border bg-surface mt-3 flex flex-wrap items-center gap-2 rounded-xl border p-2">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {available.map((kind) => (
                <button
                  aria-label={`Show ${label(kind).toLowerCase()} as primary`}
                  aria-pressed={primary === kind}
                  className={
                    primary === kind
                      ? "bg-foreground rounded-lg px-3 py-2 text-sm font-semibold text-white"
                      : "hover:bg-surface-muted rounded-lg px-3 py-2 text-sm font-semibold"
                  }
                  key={kind}
                  onClick={() => onPrimary(kind)}
                  type="button"
                >
                  {label(kind)}
                </button>
              ))}
            </div>
            {available.length > 1 && (
              <label className="text-muted flex items-center gap-2 text-sm">
                Second view
                <select
                  className="border-border bg-background text-foreground rounded-lg border px-3 py-2"
                  onChange={(event) =>
                    onPictureInPicture(
                      (event.target.value || undefined) as
                        ReplayVideoKind | undefined,
                    )
                  }
                  value={pictureInPicture ?? ""}
                >
                  <option value="">Off</option>
                  {available
                    .filter((kind) => kind !== primary)
                    .map((kind) => (
                      <option key={kind} value={kind}>
                        {label(kind)}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
        </>
      ) : (
        <div className="border-border bg-surface grid aspect-video place-items-center rounded-2xl border lg:flex-1">
          <p className="text-muted">No video track is recoverable.</p>
        </div>
      )}
    </section>
  );
}

function videoClass(
  kind: ReplayVideoKind,
  primary?: ReplayVideoKind,
  pictureInPicture?: ReplayVideoKind,
) {
  if (kind === primary)
    return "absolute inset-0 h-full w-full bg-black object-contain";
  if (kind === pictureInPicture)
    return "border-surface absolute right-3 bottom-3 z-10 h-[34%] min-h-24 w-[34%] min-w-40 rounded-xl border-4 bg-black object-cover shadow-xl";
  return "pointer-events-none absolute h-px w-px opacity-0";
}

function label(kind: ReplayVideoKind) {
  return `${kind[0].toUpperCase()}${kind.slice(1)}`;
}

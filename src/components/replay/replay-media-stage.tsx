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
    <section aria-label="Recorded views">
      {available.length ? (
        <>
          <div className="bg-foreground relative aspect-video overflow-hidden rounded-3xl shadow-sm">
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {available.map((kind) => (
              <button
                aria-pressed={primary === kind}
                className={
                  primary === kind
                    ? "bg-primary rounded-xl px-4 py-2 font-semibold text-white"
                    : "border-border bg-surface rounded-xl border px-4 py-2 font-semibold"
                }
                key={kind}
                onClick={() => onPrimary(kind)}
                type="button"
              >
                {`Show ${label(kind).toLowerCase()} as primary`}
              </button>
            ))}
            {available.length > 1 && (
              <label className="text-muted ml-auto flex items-center gap-2 text-sm">
                Second view
                <select
                  className="border-border bg-surface rounded-lg border px-3 py-2"
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
        <div className="border-border bg-surface grid aspect-video place-items-center rounded-3xl border">
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
    return "border-surface absolute right-4 bottom-4 z-10 h-[32%] w-[32%] rounded-xl border-4 bg-black object-cover shadow-xl";
  return "pointer-events-none absolute h-px w-px opacity-0";
}

function label(kind: ReplayVideoKind) {
  return `${kind[0].toUpperCase()}${kind.slice(1)}`;
}

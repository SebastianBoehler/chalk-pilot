"use client";

import Image from "next/image";
import type { BoardCorners, NormalizedPoint } from "@/features/board/types";

const CORNER_NAMES = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"];
const KEY_STEP = 0.005;

interface CalibrationStepProps {
  corners: BoardCorners;
  sourceUrl: string;
  rectifiedUrl: string | null;
  status: "detecting" | "ready" | "error";
  onCornersChange: (corners: BoardCorners) => void;
  onDetect: () => void;
  onConfirm: () => void;
}

export function CalibrationStep({
  corners,
  sourceUrl,
  rectifiedUrl,
  status,
  onCornersChange,
  onDetect,
  onConfirm,
}: CalibrationStepProps) {
  const changeCorner = (index: number, point: NormalizedPoint) => {
    const next = [...corners] as BoardCorners;
    next[index] = {
      x: clamp(point.x),
      y: clamp(point.y),
    };
    onCornersChange(next);
  };

  return (
    <section aria-labelledby="calibration-title" className="space-y-6">
      <div>
        <h1
          className="text-4xl font-semibold tracking-tight"
          id="calibration-title"
        >
          Frame the board
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-lg">
          Confirm all four corners. ChalkPilot sends only the corrected board,
          never the full room view.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="border-border relative aspect-video overflow-hidden rounded-3xl border bg-black">
          <Image
            alt="Camera view for board calibration"
            className="object-contain"
            fill
            priority
            sizes="(min-width: 1280px) 50vw, 100vw"
            src={sourceUrl}
            unoptimized
          />
          {corners.map((corner, index) => (
            <button
              aria-label={`${CORNER_NAMES[index]} corner`}
              className="bg-primary absolute size-7 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-4 border-white shadow-lg"
              key={CORNER_NAMES[index]}
              onKeyDown={(event) => {
                const delta = keyboardDelta(event.key);
                if (!delta) return;
                event.preventDefault();
                changeCorner(index, {
                  x: corner.x + delta.x,
                  y: corner.y + delta.y,
                });
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId))
                  return;
                const bounds =
                  event.currentTarget.parentElement?.getBoundingClientRect();
                if (!bounds) return;
                changeCorner(index, {
                  x: (event.clientX - bounds.left) / bounds.width,
                  y: (event.clientY - bounds.top) / bounds.height,
                });
              }}
              onPointerDown={(event) =>
                event.currentTarget.setPointerCapture(event.pointerId)
              }
              style={{ left: `${corner.x * 100}%`, top: `${corner.y * 100}%` }}
              type="button"
            />
          ))}
        </div>

        <div className="border-border bg-surface-muted relative aspect-video overflow-hidden rounded-3xl border">
          {rectifiedUrl ? (
            <Image
              alt="Perspective-corrected board preview"
              className="object-contain"
              fill
              sizes="(min-width: 1280px) 50vw, 100vw"
              src={rectifiedUrl}
              unoptimized
            />
          ) : (
            <div className="text-muted grid h-full place-items-center px-8 text-center">
              {status === "error"
                ? "The board could not be corrected. Adjust the corners and retry."
                : "Preparing the corrected board preview…"}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          className="border-border bg-surface hover:bg-surface-muted rounded-xl border px-5 py-3 font-semibold"
          onClick={onDetect}
          type="button"
        >
          Detect again
        </button>
        <button
          className="bg-primary hover:bg-primary-hover rounded-xl px-6 py-3 font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!rectifiedUrl || status !== "ready"}
          onClick={onConfirm}
          type="button"
        >
          Use this board frame
        </button>
      </div>
    </section>
  );
}

function keyboardDelta(key: string): NormalizedPoint | null {
  if (key === "ArrowLeft") return { x: -KEY_STEP, y: 0 };
  if (key === "ArrowRight") return { x: KEY_STEP, y: 0 };
  if (key === "ArrowUp") return { x: 0, y: -KEY_STEP };
  if (key === "ArrowDown") return { x: 0, y: KEY_STEP };
  return null;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}

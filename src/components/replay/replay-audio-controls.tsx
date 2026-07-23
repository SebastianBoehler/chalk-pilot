"use client";

import { useEffect, useMemo, useRef, useState, type RefCallback } from "react";
import type { TrackKind } from "@/features/recording/schema";

type AudioKind = Extract<TrackKind, "microphone" | "desktop-audio">;

export function ReplayAudioControls({
  available,
  refs,
  sourceFor,
}: {
  available: AudioKind[];
  refs: Record<TrackKind, RefCallback<HTMLMediaElement>>;
  sourceFor(kind: TrackKind): string;
}) {
  const [settings, setSettings] = useState<
    Record<AudioKind, { muted: boolean; volume: number }>
  >({
    microphone: { muted: false, volume: 1 },
    "desktop-audio": { muted: false, volume: 1 },
  });
  const elements = useRef<Partial<Record<AudioKind, HTMLAudioElement>>>({});
  const audioRefs = useMemo(
    () =>
      Object.fromEntries(
        AUDIO_KINDS.map((kind) => [
          kind,
          (element: HTMLAudioElement | null) => {
            if (element) elements.current[kind] = element;
            else delete elements.current[kind];
            refs[kind](element);
          },
        ]),
      ) as Record<AudioKind, RefCallback<HTMLAudioElement>>,
    [refs],
  );
  useEffect(() => {
    for (const kind of AUDIO_KINDS) {
      const element = elements.current[kind];
      if (!element) continue;
      element.muted = settings[kind].muted;
      element.volume = settings[kind].volume;
    }
  }, [settings]);
  if (!available.length) return null;

  return (
    <section
      aria-label="Audio tracks"
      className="border-border bg-surface mt-5 rounded-2xl border p-5"
    >
      <h2 className="text-xl font-semibold">Audio</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {available.map((kind) => {
          const setting = settings[kind];
          const name = label(kind);
          return (
            <div className="flex items-center gap-3" key={kind}>
              <audio
                data-testid={`track-${kind}`}
                muted={setting.muted}
                preload="metadata"
                ref={audioRefs[kind]}
                src={sourceFor(kind)}
              />
              <button
                className="border-border min-w-20 rounded-lg border px-3 py-2 text-sm font-semibold"
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    [kind]: { ...setting, muted: !setting.muted },
                  }))
                }
                type="button"
              >
                {setting.muted ? `Unmute ${name}` : `Mute ${name}`}
              </button>
              <label className="text-muted flex flex-1 items-center gap-2 text-sm">
                <span className="sr-only">{name} volume</span>
                <input
                  aria-label={`${name} volume`}
                  className="accent-primary w-full"
                  max={1}
                  min={0}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      [kind]: {
                        ...setting,
                        volume: Number(event.target.value),
                      },
                    }))
                  }
                  step={0.05}
                  type="range"
                  value={setting.volume}
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function label(kind: AudioKind) {
  return kind === "microphone" ? "Microphone" : "Desktop audio";
}

const AUDIO_KINDS: AudioKind[] = ["microphone", "desktop-audio"];

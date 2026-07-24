"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefCallback,
} from "react";
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
      className="border-border bg-surface mt-3 rounded-xl border px-3 py-2"
    >
      <h2 className="sr-only">Audio</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {available.map((kind) => {
          const setting = settings[kind];
          const name = label(kind);
          return (
            <div className="flex min-w-0 items-center gap-2" key={kind}>
              <audio
                data-testid={`track-${kind}`}
                muted={setting.muted}
                preload="metadata"
                ref={audioRefs[kind]}
                src={sourceFor(kind)}
              />
              <button
                aria-label={setting.muted ? `Unmute ${name}` : `Mute ${name}`}
                className="border-border hover:bg-surface-muted grid size-9 shrink-0 place-items-center rounded-lg border"
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    [kind]: { ...setting, muted: !setting.muted },
                  }))
                }
                type="button"
              >
                {setting.muted ? <MutedIcon /> : <VolumeIcon />}
              </button>
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-muted w-20 shrink-0 truncate text-xs font-semibold">
                  {name}
                </span>
                <input
                  aria-label={`${name} volume`}
                  className="replay-range w-full"
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
                  style={
                    {
                      "--range-progress": `${setting.volume * 100}%`,
                    } as CSSProperties
                  }
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VolumeIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
      <path
        d="M3.5 8h3l4-3.25v10.5L6.5 12h-3V8Zm9.5-.5a4 4 0 0 1 0 5m1.75-7.25a7 7 0 0 1 0 9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
      <path
        d="M3.5 8h3l4-3.25v10.5L6.5 12h-3V8Zm9.25.25 4 4m0-4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function label(kind: AudioKind) {
  return kind === "microphone" ? "Microphone" : "Desktop audio";
}

const AUDIO_KINDS: AudioKind[] = ["microphone", "desktop-audio"];

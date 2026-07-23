"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  hasLiveMicrophoneTrack,
  listMicrophones,
  monitorMicrophoneLevel,
  requestMicrophone,
  stopMicrophone,
} from "@/features/audio/microphone";

interface MicrophoneStepProps {
  onConfirm: (stream: MediaStream) => void;
  mediaDevices?: Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;
  monitorLevel?: (
    stream: MediaStream,
    onLevel: (level: number) => void,
  ) => () => void;
}

export function MicrophoneStep(_props: MicrophoneStepProps) {
  const {
    mediaDevices,
    monitorLevel = monitorMicrophoneLevel,
    onConfirm,
  } = _props;
  const [stream, setStream] = useState<MediaStream>();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const confirmedRef = useRef<MediaStream | undefined>(undefined);
  const requestGeneration = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    if (!stream) return;
    return monitorLevel(stream, setLevel);
  }, [monitorLevel, stream]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestGeneration.current += 1;
      const current = streamRef.current;
      if (current !== confirmedRef.current) stopMicrophone(current);
    };
  }, []);

  const openMicrophone = async (deviceId?: string) => {
    const generation = ++requestGeneration.current;
    const isCurrent = () =>
      mounted.current && generation === requestGeneration.current;
    let acquired: MediaStream | undefined;
    setBusy(true);
    setError(undefined);
    try {
      const browserMediaDevices = mediaDevices ?? navigator.mediaDevices;
      acquired = await requestMicrophone(browserMediaDevices, deviceId);
      if (!isCurrent()) {
        stopMicrophone(acquired);
        acquired = undefined;
        return;
      }
      if (!hasLiveMicrophoneTrack(acquired)) {
        throw new Error("The selected microphone has no live audio track.");
      }
      const nextDevices = await listMicrophones(browserMediaDevices);
      if (!isCurrent()) {
        stopMicrophone(acquired);
        acquired = undefined;
        return;
      }
      stopMicrophone(streamRef.current);
      streamRef.current = acquired;
      setLevel(0);
      setStream(acquired);
      setDevices(nextDevices);
      setSelectedId(
        acquired.getAudioTracks()[0]?.getSettings().deviceId ??
          deviceId ??
          nextDevices[0]?.deviceId ??
          "",
      );
      acquired = undefined;
    } catch (cause) {
      stopMicrophone(acquired);
      if (isCurrent()) setError(microphoneError(cause));
    } finally {
      if (isCurrent()) setBusy(false);
    }
  };

  const confirm = () => {
    if (!stream || !hasLiveMicrophoneTrack(stream)) return;
    confirmedRef.current = stream;
    onConfirm(stream);
  };

  return (
    <section aria-labelledby="microphone-title" className="space-y-6">
      <div>
        <h1
          className="text-4xl font-semibold tracking-tight"
          id="microphone-title"
        >
          Check the room microphone
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-lg">
          Speak at teaching distance and choose the input that shows a clear,
          responsive level.
        </p>
      </div>

      {error && (
        <div className="border-danger/30 bg-danger/5 rounded-2xl border p-5">
          <p className="text-danger font-semibold">Microphone unavailable</p>
          <p className="text-muted mt-1">{error}</p>
        </div>
      )}

      {!stream ? (
        <Button
          disabled={busy}
          onClick={() => void openMicrophone()}
          type="button"
        >
          {busy ? "Connecting…" : "Allow microphone"}
        </Button>
      ) : (
        <div className="max-w-xl space-y-5">
          <div>
            <label
              className="block text-sm font-semibold"
              htmlFor="microphone-device"
            >
              Microphone
            </label>
            <select
              className="border-border bg-surface mt-2 w-full rounded-xl border px-4 py-3"
              id="microphone-device"
              onChange={(event) => void openMicrophone(event.target.value)}
              value={selectedId}
            >
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="block text-sm font-semibold"
              htmlFor="input-level"
            >
              Input level
            </label>
            <meter
              aria-label="Input level"
              className="mt-2 h-3 w-full"
              id="input-level"
              max={1}
              min={0}
              value={level}
            />
          </div>
          <Button disabled={busy} onClick={confirm} type="button">
            Confirm microphone
          </Button>
        </div>
      )}
    </section>
  );
}

function microphoneError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone permission was denied. Allow access in the browser and try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found. Check the room cable and input device.";
  }
  return error instanceof Error
    ? error.message
    : "The microphone could not be opened.";
}

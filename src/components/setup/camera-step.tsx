"use client";

import { useEffect, useRef, useState } from "react";
import {
  listVideoDevices,
  requestCamera,
  stopCamera,
} from "@/features/board/camera";

type CameraMediaDevices = Pick<
  MediaDevices,
  "enumerateDevices" | "getUserMedia"
>;

interface CameraStepProps {
  onReady: (video: HTMLVideoElement, stream: MediaStream) => void;
  mediaDevices?: CameraMediaDevices;
}

export function CameraStep({ onReady, mediaDevices }: CameraStepProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream>();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) video.srcObject = stream;
    return () => {
      if (video) video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => () => stopCamera(stream), [stream]);

  const openCamera = async (deviceId?: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const browserMediaDevices = mediaDevices ?? navigator.mediaDevices;
      const nextStream = await requestCamera(browserMediaDevices, deviceId);
      const nextDevices = await listVideoDevices(browserMediaDevices);
      stopCamera(stream);
      setStream(nextStream);
      setDevices(nextDevices);
      const activeId =
        nextStream.getVideoTracks()[0]?.getSettings().deviceId ??
        deviceId ??
        nextDevices[0]?.deviceId ??
        "";
      setSelectedId(activeId);
    } catch (cause) {
      setError(cameraError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="camera-title" className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight" id="camera-title">
          Connect the room camera
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-lg">
          The live view stays on this Mac. ChalkPilot sends only a corrected
          board image when you finish a turn or explicitly ask it to look.
        </p>
      </div>

      {error && (
        <div className="border-danger/30 bg-danger/5 rounded-2xl border p-5">
          <p className="text-danger font-semibold">Camera unavailable</p>
          <p className="text-muted mt-1">{error}</p>
        </div>
      )}

      {!stream ? (
        <button
          className="bg-primary hover:bg-primary-hover rounded-xl px-6 py-3 font-semibold text-white shadow-sm disabled:opacity-50"
          disabled={busy}
          onClick={() => void openCamera()}
          type="button"
        >
          {busy ? "Connecting…" : "Allow camera"}
        </button>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <video
            autoPlay
            className="aspect-video w-full rounded-3xl bg-black object-contain"
            muted
            onLoadedMetadata={(event) => onReady(event.currentTarget, stream)}
            playsInline
            ref={videoRef}
          />
          <div className="space-y-3">
            <label
              className="block text-sm font-semibold"
              htmlFor="camera-device"
            >
              Camera
            </label>
            <select
              className="border-border bg-surface w-full rounded-xl border px-4 py-3"
              id="camera-device"
              onChange={(event) => void openCamera(event.target.value)}
              value={selectedId}
            >
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
            <p className="text-muted text-sm">
              Choose the rear high-resolution room camera when available.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function cameraError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Camera permission was denied. Allow access in the browser and try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No camera was found. Check the room cable and camera power.";
  }
  return error instanceof Error
    ? error.message
    : "The camera could not be opened.";
}

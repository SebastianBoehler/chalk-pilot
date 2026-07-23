"use client";

import { useEffect, useRef, useState } from "react";
import {
  listVideoDevices,
  requestCamera,
  stopCamera,
} from "@/features/board/camera";
import type { CameraUse } from "@/features/setup/camera-use";

type CameraMediaDevices = Pick<
  MediaDevices,
  "enumerateDevices" | "getUserMedia"
>;

interface CameraStepProps {
  onReady: (video: HTMLVideoElement, stream: MediaStream) => void;
  cameraUse: CameraUse | "pending";
  onCameraUseChange: (cameraUse: CameraUse) => void;
  mediaDevices?: CameraMediaDevices;
}

export function CameraStep({
  cameraUse,
  onCameraUseChange,
  onReady,
  mediaDevices,
}: CameraStepProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream>();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const guidance = cameraGuidance(cameraUse);

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
          Connect a camera
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-lg">
          The live view stays on this Mac. ChalkPilot sends only a corrected
          board image when you finish a turn or explicitly ask it to look.
        </p>
        <p className="text-muted mt-2 max-w-2xl text-sm">
          {guidance}
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Camera use</legend>
        <div className="mt-2 grid max-w-2xl gap-3 sm:grid-cols-2">
          <CameraUseOption
            checked={cameraUse === "room-wide"}
            description="A wide room view where ChalkPilot follows a confirmed presenter."
            label="Room-wide camera"
            onChange={() => onCameraUseChange("room-wide")}
          />
          <CameraUseOption
            checked={cameraUse === "board-focused"}
            description="A fixed nearby view pointed at a whiteboard or flip chart."
            label="Board-focused camera"
            onChange={() => onCameraUseChange("board-focused")}
          />
        </div>
      </fieldset>

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
              Choose the camera for this setup. A nearby webcam, room camera,
              or iPhone Continuity Camera can appear here.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function cameraGuidance(cameraUse: CameraUse | "pending"): string {
  if (cameraUse === "board-focused") {
    return "At home, point a nearby webcam or iPhone Continuity Camera at a whiteboard or flip chart. ChalkPilot uses the fixed frame for the board, so presenter tracking is skipped.";
  }

  if (cameraUse === "room-wide") {
    return "In an auditorium, set the room camera to its manual, widest view. ChalkPilot derives the board and speaker crops from that full frame, then uses presenter tracking for the speaker crop.";
  }

  return "Choose whether this is a room-wide or board-focused camera before allowing access.";
}

function CameraUseOption({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="border-border bg-surface flex cursor-pointer gap-3 rounded-2xl border p-4">
      <input
        checked={checked}
        name="camera-use"
        onChange={onChange}
        type="radio"
      />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="text-muted mt-1 block text-sm">{description}</span>
      </span>
    </label>
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

import { describe, expect, it } from "vitest";
import {
  buildCameraConstraints,
  listVideoDevices,
  requestCamera,
  stopCamera,
} from "./camera";

describe("camera constraints", () => {
  it("prefers a high-resolution rear camera", () => {
    expect(buildCameraConstraints()).toEqual({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        height: { ideal: 2160 },
        width: { ideal: 3840 },
      },
    });
  });

  it("targets an explicitly selected device", () => {
    expect(buildCameraConstraints("camera-2").video).toMatchObject({
      deviceId: { exact: "camera-2" },
    });
  });

  it("requests the stream with the selected constraints", async () => {
    const stream = { getTracks: () => [] } as unknown as MediaStream;
    let received: MediaStreamConstraints | undefined;
    const mediaDevices = {
      getUserMedia: async (constraints: MediaStreamConstraints) => {
        received = constraints;
        return stream;
      },
      enumerateDevices: async () => [
        { deviceId: "video", kind: "videoinput", label: "Room camera" },
        { deviceId: "audio", kind: "audioinput", label: "Microphone" },
      ],
    } as Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;

    await expect(requestCamera(mediaDevices, "video")).resolves.toBe(stream);
    await expect(listVideoDevices(mediaDevices)).resolves.toHaveLength(1);
    expect(received).toEqual(buildCameraConstraints("video"));
  });

  it("stops every camera track", () => {
    let stopped = 0;
    const stream = {
      getTracks: () => [{ stop: () => stopped++ }, { stop: () => stopped++ }],
    } as unknown as MediaStream;

    stopCamera(stream);

    expect(stopped).toBe(2);
  });
});

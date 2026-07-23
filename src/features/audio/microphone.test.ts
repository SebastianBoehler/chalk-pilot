import { describe, expect, it, vi } from "vitest";
import {
  hasLiveMicrophoneTrack,
  listMicrophones,
  normalizeMicrophoneLevel,
  requestMicrophone,
} from "./microphone";

describe("microphone input", () => {
  it("lists only audio input devices", async () => {
    const mediaDevices = {
      enumerateDevices: vi.fn().mockResolvedValue([
        { deviceId: "camera", kind: "videoinput", label: "Room camera" },
        { deviceId: "mic-1", kind: "audioinput", label: "Lectern mic" },
        { deviceId: "speaker", kind: "audiooutput", label: "Room speakers" },
      ]),
      getUserMedia: vi.fn(),
    } as unknown as Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;

    await expect(listMicrophones(mediaDevices)).resolves.toEqual([
      expect.objectContaining({ deviceId: "mic-1", kind: "audioinput" }),
    ]);
  });

  it("requests the explicitly selected microphone without video", async () => {
    const stream = {} as MediaStream;
    const mediaDevices = {
      enumerateDevices: vi.fn(),
      getUserMedia: vi.fn().mockResolvedValue(stream),
    } as unknown as Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;

    await expect(requestMicrophone(mediaDevices, "mic-2")).resolves.toBe(
      stream,
    );
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { exact: "mic-2" } },
      video: false,
    });
  });

  it("recognizes only a live audio track", () => {
    const stream = {
      getAudioTracks: () => [{ readyState: "live" }],
    } as MediaStream;
    const ended = {
      getAudioTracks: () => [{ readyState: "ended" }],
    } as MediaStream;

    expect(hasLiveMicrophoneTrack(stream)).toBe(true);
    expect(hasLiveMicrophoneTrack(ended)).toBe(false);
  });

  it("normalizes silence and full-scale samples for the meter", () => {
    expect(normalizeMicrophoneLevel(new Uint8Array([128, 128]))).toBe(0);
    expect(normalizeMicrophoneLevel(new Uint8Array([0, 255]))).toBeCloseTo(
      1,
      2,
    );
  });
});

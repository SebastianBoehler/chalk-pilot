import { afterEach, describe, expect, it, vi } from "vitest";
import { createMicrophoneTransport } from "./microphone-transport";

function microphoneFixture() {
  const originalTrack = {
    readyState: "live",
    stop: vi.fn(),
  };
  const transportTrack = {
    readyState: "live",
    stop: vi.fn(function (this: { readyState: string }) {
      this.readyState = "ended";
    }),
  };
  const transportStream = {
    getTracks: () => [transportTrack],
    getAudioTracks: () => [transportTrack],
  } as unknown as MediaStream;
  const microphone = {
    clone: vi.fn(() => transportStream),
    getTracks: () => [originalTrack],
    getAudioTracks: () => [originalTrack],
  } as unknown as MediaStream;
  return { microphone, originalTrack, transportStream, transportTrack };
}

describe("microphone Realtime transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stops only its cloned stream when closed", () => {
    vi.stubGlobal("RTCPeerConnection", class {});
    const fixture = microphoneFixture();

    const transport = createMicrophoneTransport(fixture.microphone);
    transport.close();

    expect(fixture.microphone.clone).toHaveBeenCalledOnce();
    expect(fixture.transportTrack.stop).toHaveBeenCalledOnce();
    expect(fixture.originalTrack.stop).not.toHaveBeenCalled();
  });

  it("stops its cloned stream when connect rejects before creating a peer", async () => {
    vi.stubGlobal("RTCPeerConnection", class {});
    const fixture = microphoneFixture();
    const transport = createMicrophoneTransport(fixture.microphone);
    const failure = new Error("client secret unavailable");

    await expect(
      transport.connect({
        apiKey: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);

    expect(fixture.transportTrack.stop).toHaveBeenCalledOnce();
    expect(fixture.originalTrack.stop).not.toHaveBeenCalled();
  });
});

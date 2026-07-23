import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import type { OpenAIRealtimeWebRTC } from "@openai/agents/realtime";
import {
  createMicrophoneTransport,
  OwnedMicrophoneWebRTC,
} from "./microphone-transport";

type ConnectOptions = Parameters<OpenAIRealtimeWebRTC["connect"]>[0];

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

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

class ControlledMicrophoneWebRTC extends OwnedMicrophoneWebRTC {
  readonly baseConnect: Mock<(options: ConnectOptions) => Promise<void>>;
  readonly baseClose = vi.fn();

  constructor(transportStream: MediaStream, connection: Promise<void>) {
    super(transportStream);
    this.baseConnect = vi.fn((options: ConnectOptions) => {
      void options;
      return connection;
    });
  }

  protected override connectBase(options: ConnectOptions) {
    return this.baseConnect(options) as Promise<void>;
  }

  protected override closeBase() {
    this.baseClose();
  }
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

  it("rejects connect without calling the base transport after close", async () => {
    vi.stubGlobal("RTCPeerConnection", class {});
    const fixture = microphoneFixture();
    const transport = new ControlledMicrophoneWebRTC(
      fixture.transportStream,
      Promise.resolve(),
    );

    transport.close();

    await expect(
      transport.connect({ apiKey: "ek_test_secret" }),
    ).rejects.toThrow("The microphone transport is closed.");
    expect(transport.baseConnect).not.toHaveBeenCalled();
    expect(transport.baseClose).toHaveBeenCalledOnce();
  });

  it("closes a revived base transport and rejects when close wins the race", async () => {
    vi.stubGlobal("RTCPeerConnection", class {});
    const fixture = microphoneFixture();
    const connection = deferred();
    const transport = new ControlledMicrophoneWebRTC(
      fixture.transportStream,
      connection.promise,
    );

    const connecting = transport.connect({ apiKey: "ek_test_secret" });
    expect(transport.baseConnect).toHaveBeenCalledOnce();
    transport.close();
    connection.resolve();

    await expect(connecting).rejects.toThrow(
      "The microphone transport is closed.",
    );
    expect(transport.baseClose).toHaveBeenCalledTimes(2);
    expect(fixture.transportTrack.stop).toHaveBeenCalledOnce();
  });

  it("leaves an active successful connection and clone live", async () => {
    vi.stubGlobal("RTCPeerConnection", class {});
    const fixture = microphoneFixture();
    const transport = new ControlledMicrophoneWebRTC(
      fixture.transportStream,
      Promise.resolve(),
    );

    await expect(
      transport.connect({ apiKey: "ek_test_secret" }),
    ).resolves.toBeUndefined();

    expect(transport.baseClose).not.toHaveBeenCalled();
    expect(fixture.transportTrack.stop).not.toHaveBeenCalled();
  });

  it("preserves a base failure after the base closes its transport", async () => {
    vi.stubGlobal("RTCPeerConnection", class {});
    const fixture = microphoneFixture();
    const connection = deferred();
    const failure = new Error("Realtime handshake failed");
    const transport = new ControlledMicrophoneWebRTC(
      fixture.transportStream,
      connection.promise,
    );

    const connecting = transport.connect({ apiKey: "ek_test_secret" });
    transport.close();
    connection.reject(failure);

    await expect(connecting).rejects.toBe(failure);
    expect(transport.baseClose).toHaveBeenCalledTimes(2);
    expect(fixture.transportTrack.stop).toHaveBeenCalledOnce();
  });
});

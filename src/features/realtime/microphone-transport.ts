import { OpenAIRealtimeWebRTC } from "@openai/agents/realtime";

export function createMicrophoneTransport(
  microphone: MediaStream,
): OpenAIRealtimeWebRTC {
  const transportStream = microphone.clone();
  try {
    return new OwnedMicrophoneWebRTC(transportStream);
  } catch (error) {
    stopLiveTracks(transportStream);
    throw error;
  }
}

export class OwnedMicrophoneWebRTC extends OpenAIRealtimeWebRTC {
  private released = false;
  private closed = false;

  constructor(private readonly transportStream: MediaStream) {
    super({ mediaStream: transportStream });
  }

  override async connect(
    options: Parameters<OpenAIRealtimeWebRTC["connect"]>[0],
  ): Promise<void> {
    if (this.closed) throw microphoneTransportClosedError();
    try {
      await this.connectBase(options);
    } catch (error) {
      if (this.closed) this.closeBase();
      this.release();
      throw error;
    }
    if (this.closed) {
      this.closeBase();
      throw microphoneTransportClosedError();
    }
  }

  override close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.closeBase();
    } finally {
      this.release();
    }
  }

  protected connectBase(
    options: Parameters<OpenAIRealtimeWebRTC["connect"]>[0],
  ) {
    return super.connect(options);
  }

  protected closeBase() {
    super.close();
  }

  private release() {
    if (this.released) return;
    this.released = true;
    stopLiveTracks(this.transportStream);
  }
}

function stopLiveTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => {
    if (track.readyState !== "ended") track.stop();
  });
}

function microphoneTransportClosedError() {
  return new Error("The microphone transport is closed.");
}

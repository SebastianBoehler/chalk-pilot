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

class OwnedMicrophoneWebRTC extends OpenAIRealtimeWebRTC {
  private released = false;

  constructor(private readonly transportStream: MediaStream) {
    super({ mediaStream: transportStream });
  }

  override async connect(
    options: Parameters<OpenAIRealtimeWebRTC["connect"]>[0],
  ): Promise<void> {
    try {
      await super.connect(options);
    } catch (error) {
      this.release();
      throw error;
    }
  }

  override close(): void {
    try {
      super.close();
    } finally {
      this.release();
    }
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

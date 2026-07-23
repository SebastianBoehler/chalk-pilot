type MicrophoneMediaDevices = Pick<
  MediaDevices,
  "enumerateDevices" | "getUserMedia"
>;

export async function listMicrophones(
  mediaDevices: MicrophoneMediaDevices,
): Promise<MediaDeviceInfo[]> {
  return (await mediaDevices.enumerateDevices()).filter(
    (device) => device.kind === "audioinput",
  ) as MediaDeviceInfo[];
}

export async function requestMicrophone(
  mediaDevices: MicrophoneMediaDevices,
  deviceId?: string,
): Promise<MediaStream> {
  return mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    video: false,
  });
}

export function hasLiveMicrophoneTrack(stream: MediaStream): boolean {
  return stream.getAudioTracks().some((track) => track.readyState === "live");
}

export function normalizeMicrophoneLevel(samples: Uint8Array): number {
  if (samples.length === 0) return 0;
  const meanSquare =
    samples.reduce((total, sample) => {
      const centered = sample - 128;
      return total + centered * centered;
    }, 0) / samples.length;
  return Math.min(1, Math.sqrt(meanSquare) / 128);
}

export function stopMicrophone(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function monitorMicrophoneLevel(
  stream: MediaStream,
  onLevel: (level: number) => void,
): () => void {
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  let frame = 0;

  const sample = () => {
    analyser.getByteTimeDomainData(samples);
    onLevel(normalizeMicrophoneLevel(samples));
    frame = window.requestAnimationFrame(sample);
  };
  frame = window.requestAnimationFrame(sample);

  return () => {
    window.cancelAnimationFrame(frame);
    source.disconnect();
    analyser.disconnect();
    void context.close();
  };
}

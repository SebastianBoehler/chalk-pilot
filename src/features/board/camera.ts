type CameraMediaDevices = Pick<
  MediaDevices,
  "enumerateDevices" | "getUserMedia"
>;

export function buildCameraConstraints(
  deviceId?: string,
): MediaStreamConstraints & { video: MediaTrackConstraints } {
  return {
    audio: false,
    video: {
      ...(deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: "environment" } }),
      height: { ideal: 2160 },
      width: { ideal: 3840 },
    },
  };
}

export async function requestCamera(
  mediaDevices: CameraMediaDevices,
  deviceId?: string,
): Promise<MediaStream> {
  return mediaDevices.getUserMedia(buildCameraConstraints(deviceId));
}

export async function listVideoDevices(
  mediaDevices: CameraMediaDevices,
): Promise<MediaDeviceInfo[]> {
  return (await mediaDevices.enumerateDevices()).filter(
    (device) => device.kind === "videoinput",
  ) as MediaDeviceInfo[];
}

export function stopCamera(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

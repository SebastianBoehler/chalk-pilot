import type { BoardSize } from "./types";

interface SizedCalibration {
  sourceSize: BoardSize;
}

interface VideoDimensions {
  videoWidth: number;
  videoHeight: number;
}

export function calibrationMatchesVideo(
  calibration: SizedCalibration,
  video: VideoDimensions,
) {
  return (
    video.videoWidth > 0 &&
    video.videoHeight > 0 &&
    calibration.sourceSize.width === video.videoWidth &&
    calibration.sourceSize.height === video.videoHeight
  );
}

export function watchCalibrationDimensions(
  video: HTMLVideoElement,
  calibration: SizedCalibration,
  onChange: () => void,
) {
  const validate = () => {
    if (
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      !calibrationMatchesVideo(calibration, video)
    ) {
      onChange();
    }
  };
  video.addEventListener("loadedmetadata", validate);
  video.addEventListener("resize", validate);
  validate();
  return () => {
    video.removeEventListener("loadedmetadata", validate);
    video.removeEventListener("resize", validate);
  };
}

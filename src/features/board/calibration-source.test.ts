import { describe, expect, it } from "vitest";
import {
  calibrationMatchesVideo,
  watchCalibrationDimensions,
} from "./calibration-source";

describe("calibrationMatchesVideo", () => {
  it("invalidates a 1920x1200 calibration after a 3840x2160 stream change", () => {
    const calibration = { sourceSize: { width: 1_920, height: 1_200 } };

    expect(
      calibrationMatchesVideo(calibration, {
        videoHeight: 1_200,
        videoWidth: 1_920,
      }),
    ).toBe(true);
    expect(
      calibrationMatchesVideo(calibration, {
        videoHeight: 2_160,
        videoWidth: 3_840,
      }),
    ).toBe(false);
  });

  it("rejects camera metadata without usable dimensions", () => {
    expect(
      calibrationMatchesVideo(
        { sourceSize: { width: 1_920, height: 1_200 } },
        { videoHeight: 0, videoWidth: 0 },
      ),
    ).toBe(false);
  });

  it("reports a runtime resize and removes its listeners on disposal", () => {
    const video = new EventTarget() as HTMLVideoElement;
    Object.defineProperties(video, {
      videoHeight: { configurable: true, value: 1_200 },
      videoWidth: { configurable: true, value: 1_920 },
    });
    let changes = 0;
    const stop = watchCalibrationDimensions(
      video,
      { sourceSize: { width: 1_920, height: 1_200 } },
      () => changes++,
    );
    Object.defineProperties(video, {
      videoHeight: { configurable: true, value: 2_160 },
      videoWidth: { configurable: true, value: 3_840 },
    });

    video.dispatchEvent(new Event("resize"));
    expect(changes).toBe(1);
    stop();
    video.dispatchEvent(new Event("resize"));
    expect(changes).toBe(1);
  });
});

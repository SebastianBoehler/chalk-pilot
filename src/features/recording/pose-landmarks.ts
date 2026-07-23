import type { PersonBox } from "./presenter-tracker";

export interface PoseLandmark {
  x: number;
  y: number;
  visibility?: number;
}

const MIN_VISIBLE_LANDMARKS = 4;
const MIN_VISIBILITY = 0.35;
const HORIZONTAL_PADDING = 0.04;
const VERTICAL_PADDING = 0.03;

export function poseLandmarksToBoxes(poses: PoseLandmark[][]): PersonBox[] {
  return poses.flatMap((pose, index) => {
    const visible = pose.filter(
      (landmark) =>
        Number.isFinite(landmark.x) &&
        Number.isFinite(landmark.y) &&
        (landmark.visibility ?? 1) >= MIN_VISIBILITY,
    );
    if (visible.length < MIN_VISIBLE_LANDMARKS) return [];
    const left = clamp(
      Math.min(...visible.map(({ x }) => x)) - HORIZONTAL_PADDING,
    );
    const top = clamp(
      Math.min(...visible.map(({ y }) => y)) - VERTICAL_PADDING,
    );
    const right = clamp(
      Math.max(...visible.map(({ x }) => x)) + HORIZONTAL_PADDING,
    );
    const bottom = clamp(
      Math.max(...visible.map(({ y }) => y)) + VERTICAL_PADDING,
    );
    if (right <= left || bottom <= top) return [];
    return [
      {
        id: `pose-${index}`,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      },
    ];
  });
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

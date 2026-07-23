import type { NormalizedPoint } from "@/features/board/types";

export interface PersonBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PresenterState {
  box: PersonBox;
  lossCount: number;
  status: "tracking" | "lost";
}

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_ASSOCIATION_DISTANCE = 0.28;
const SMOOTHING_TIME_MS = 90;

export function selectPresenter(
  boxes: PersonBox[],
  point: NormalizedPoint,
): PersonBox {
  const matches = boxes.filter((box) => contains(box, point));
  if (matches.length === 0) {
    throw new Error("Select a detected presenter in the camera preview.");
  }
  return matches.reduce((smallest, box) =>
    box.width * box.height < smallest.width * smallest.height ? box : smallest,
  );
}

export function updatePresenter(
  previous: PresenterState,
  boxes: PersonBox[],
): PresenterState {
  const candidate = nearest(previous.box, boxes);
  if (
    !candidate ||
    centerDistance(previous.box, candidate) > MAX_ASSOCIATION_DISTANCE
  ) {
    return {
      ...previous,
      lossCount: previous.lossCount + 1,
      status: "lost",
    };
  }
  return {
    box: { ...candidate, id: previous.box.id },
    lossCount: 0,
    status: "tracking",
  };
}

export function interpolatePresenterBox(
  current: PersonBox,
  target: PersonBox,
  elapsedMs: number,
): PersonBox {
  const alpha = 1 - Math.exp(-Math.max(0, elapsedMs) / SMOOTHING_TIME_MS);
  return {
    id: current.id,
    x: mix(current.x, target.x, alpha),
    y: mix(current.y, target.y, alpha),
    width: mix(current.width, target.width, alpha),
    height: mix(current.height, target.height, alpha),
  };
}

export function presenterCrop(
  sourceWidth: number,
  sourceHeight: number,
  presenter: PersonBox,
): PixelCrop {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("The speaker crop requires a live camera frame.");
  }
  const personWidth = presenter.width * sourceWidth;
  const personHeight = presenter.height * sourceHeight;
  let cropWidth = Math.max(sourceWidth * 0.26, personWidth * 2.1);
  let cropHeight = Math.max(personHeight * 1.2, cropWidth * (9 / 16));
  cropWidth = Math.max(cropWidth, cropHeight * (16 / 9));
  cropHeight = cropWidth * (9 / 16);
  if (cropWidth > sourceWidth || cropHeight > sourceHeight) {
    const scale = Math.min(sourceWidth / cropWidth, sourceHeight / cropHeight);
    cropWidth *= scale;
    cropHeight *= scale;
  }
  const centerX = (presenter.x + presenter.width / 2) * sourceWidth;
  const centerY = (presenter.y + presenter.height / 2) * sourceHeight;
  const width = Math.max(1, Math.round(cropWidth));
  const height = Math.max(1, Math.round(cropHeight));
  return {
    x: Math.round(clamp(centerX - width / 2, 0, sourceWidth - width)),
    y: Math.round(clamp(centerY - height / 2, 0, sourceHeight - height)),
    width,
    height,
  };
}

function nearest(reference: PersonBox, boxes: PersonBox[]) {
  return boxes.reduce<PersonBox | undefined>((best, candidate) => {
    if (!best) return candidate;
    return centerDistance(reference, candidate) <
      centerDistance(reference, best)
      ? candidate
      : best;
  }, undefined);
}

function contains(box: PersonBox, point: NormalizedPoint) {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

function centerDistance(first: PersonBox, second: PersonBox) {
  return Math.hypot(
    first.x + first.width / 2 - (second.x + second.width / 2),
    first.y + first.height / 2 - (second.y + second.height / 2),
  );
}

function mix(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

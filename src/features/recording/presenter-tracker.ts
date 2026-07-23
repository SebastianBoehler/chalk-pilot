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
  motion?: BoxMotion;
  reacquisition?: {
    box: PersonBox;
    count: number;
  };
}

interface BoxMotion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_ASSOCIATION_DISTANCE = 0.28;
const AMBIGUITY_MARGIN = 0.06;
const REACQUISITION_MATCH_DISTANCE = 0.08;
const REACQUISITION_CONFIRMATIONS = 2;
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
  if (previous.status === "lost") {
    return updateLostPresenter(previous, boxes);
  }
  const expected = applyMotion(previous.box, previous.motion);
  const candidate = associate(expected, boxes);
  if (!candidate) return markLost(previous);
  return {
    box: preserveIdentity(previous.box, candidate),
    lossCount: 0,
    motion: measureMotion(previous.box, candidate),
    status: "tracking",
  };
}

function updateLostPresenter(
  previous: PresenterState,
  boxes: PersonBox[],
): PresenterState {
  const candidate = associate(previous.box, boxes);
  if (!candidate) return markLost(previous);
  const prior = previous.reacquisition;
  const stable = Boolean(
    prior &&
    centerDistance(prior.box, candidate) <= REACQUISITION_MATCH_DISTANCE &&
    shapePenalty(prior.box, candidate) <= 0.35,
  );
  const reacquisition = {
    box: candidate,
    count: stable ? prior!.count + 1 : 1,
  };
  if (reacquisition.count < REACQUISITION_CONFIRMATIONS) {
    return {
      ...previous,
      lossCount: previous.lossCount + 1,
      reacquisition,
    };
  }
  return {
    box: preserveIdentity(previous.box, candidate),
    lossCount: 0,
    motion: undefined,
    reacquisition: undefined,
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

function associate(reference: PersonBox, boxes: PersonBox[]) {
  const ranked = boxes
    .filter((candidate) => plausible(reference, candidate))
    .map((box) => ({ box, score: associationScore(reference, box) }))
    .sort((first, second) => first.score - second.score);
  const best = ranked[0];
  if (!best) return undefined;
  if (ranked[1] && ranked[1].score - best.score < AMBIGUITY_MARGIN) {
    return undefined;
  }
  return best.box;
}

function plausible(reference: PersonBox, candidate: PersonBox) {
  return (
    centerDistance(reference, candidate) <= MAX_ASSOCIATION_DISTANCE &&
    dimensionRatio(reference.width, candidate.width) >= 0.55 &&
    dimensionRatio(reference.height, candidate.height) >= 0.55 &&
    shapePenalty(reference, candidate) <= 0.75
  );
}

function associationScore(reference: PersonBox, candidate: PersonBox) {
  return (
    centerDistance(reference, candidate) * 3 +
    (1 - intersectionOverUnion(reference, candidate)) * 0.35 +
    shapePenalty(reference, candidate) * 0.4
  );
}

function markLost(previous: PresenterState): PresenterState {
  return {
    ...previous,
    lossCount: previous.lossCount + 1,
    reacquisition: undefined,
    status: "lost",
  };
}

function preserveIdentity(reference: PersonBox, candidate: PersonBox) {
  return { ...candidate, id: reference.id };
}

function applyMotion(box: PersonBox, motion: BoxMotion | undefined) {
  if (!motion) return box;
  const width = clamp(box.width + motion.width, 0.01, 1);
  const height = clamp(box.height + motion.height, 0.01, 1);
  return {
    ...box,
    x: clamp(box.x + motion.x, 0, 1 - width),
    y: clamp(box.y + motion.y, 0, 1 - height),
    width,
    height,
  };
}

function measureMotion(previous: PersonBox, current: PersonBox): BoxMotion {
  return {
    x: current.x - previous.x,
    y: current.y - previous.y,
    width: current.width - previous.width,
    height: current.height - previous.height,
  };
}

function shapePenalty(reference: PersonBox, candidate: PersonBox) {
  return (
    Math.abs(Math.log(candidate.width / reference.width)) +
    Math.abs(Math.log(candidate.height / reference.height)) +
    Math.abs(
      Math.log(
        candidate.width /
          candidate.height /
          (reference.width / reference.height),
      ),
    )
  );
}

function dimensionRatio(first: number, second: number) {
  return Math.min(first, second) / Math.max(first, second);
}

function intersectionOverUnion(first: PersonBox, second: PersonBox) {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union =
    first.width * first.height + second.width * second.height - intersection;
  return union > 0 ? intersection / union : 0;
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

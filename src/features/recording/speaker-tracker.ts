export interface SpeakerTarget {
  x: number;
  y: number;
}

export function updateSpeakerTarget(
  previous: Uint8Array,
  current: Uint8Array,
  width: number,
  height: number,
  target: SpeakerTarget,
): SpeakerTarget {
  if (
    width <= 0 ||
    height <= 0 ||
    previous.length !== current.length ||
    current.length !== width * height
  ) {
    return target;
  }

  let changed = 0;
  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < current.length; index += 1) {
    if (Math.abs(current[index] - previous[index]) < 28) continue;
    changed += 1;
    sumX += index % width;
    sumY += Math.floor(index / width);
  }
  if (changed < Math.max(4, current.length * 0.005)) return target;

  const detected = {
    x: (sumX / changed + 0.5) / width,
    y: (sumY / changed + 0.5) / height,
  };
  return {
    x: clamp(target.x + (detected.x - target.x) * 0.25, 0.2, 0.8),
    y: clamp(target.y + (detected.y - target.y) * 0.25, 0.25, 0.75),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

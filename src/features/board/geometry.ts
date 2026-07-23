import type { BoardCorners, BoardSize, NormalizedPoint } from "./types";

const MAX_OUTPUT_WIDTH = 1920;

export function orderCorners(points: NormalizedPoint[]): BoardCorners {
  if (points.length !== 4)
    throw new Error("A board requires exactly four corners");
  for (const point of points) {
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < 0 ||
      point.x > 1 ||
      point.y < 0 ||
      point.y > 1
    ) {
      throw new Error("Board corners must use normalized coordinates");
    }
  }
  const keys = new Set(
    points.map(({ x, y }) => `${x.toFixed(6)}:${y.toFixed(6)}`),
  );
  if (keys.size !== 4) throw new Error("Board corners must be distinct");

  const byHeight = [...points].sort((a, b) => a.y - b.y);
  const top = byHeight.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = byHeight.slice(2).sort((a, b) => a.x - b.x);
  const ordered: BoardCorners = [top[0], top[1], bottom[1], bottom[0]];
  if (polygonArea(ordered) < 0.005) {
    throw new Error("Board corners must enclose a visible area");
  }
  return ordered;
}

export function outputBoardSize(
  corners: BoardCorners,
  sourceWidth: number,
  sourceHeight: number,
): BoardSize {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const width = Math.max(
    distance(topLeft, topRight, sourceWidth, sourceHeight),
    distance(bottomLeft, bottomRight, sourceWidth, sourceHeight),
  );
  const height = Math.max(
    distance(topLeft, bottomLeft, sourceWidth, sourceHeight),
    distance(topRight, bottomRight, sourceWidth, sourceHeight),
  );
  const scale = Math.min(1, MAX_OUTPUT_WIDTH / width);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function distance(
  first: NormalizedPoint,
  second: NormalizedPoint,
  width: number,
  height: number,
): number {
  return Math.hypot(
    (first.x - second.x) * width,
    (first.y - second.y) * height,
  );
}

function polygonArea(points: BoardCorners): number {
  return (
    Math.abs(
      points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point.x * next.y - next.x * point.y;
      }, 0),
    ) / 2
  );
}

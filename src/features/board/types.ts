export interface NormalizedPoint {
  x: number;
  y: number;
}

export type BoardCorners = [
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint,
];

export interface BoardSize {
  width: number;
  height: number;
}

export interface DetectionResult {
  corners: BoardCorners | null;
  confidence: number;
}

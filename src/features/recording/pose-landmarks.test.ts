import { describe, expect, it } from "vitest";
import { poseLandmarksToBoxes } from "./pose-landmarks";

describe("poseLandmarksToBoxes", () => {
  it("converts visible poses to bounded normalized boxes", () => {
    const boxes = poseLandmarksToBoxes([
      [
        { x: 0.2, y: 0.1, visibility: 0.9 },
        { x: 0.4, y: 0.15, visibility: 0.9 },
        { x: 0.25, y: 0.8, visibility: 0.9 },
        { x: 0.45, y: 0.9, visibility: 0.9 },
      ],
      [
        { x: -0.1, y: 0.2, visibility: 0.9 },
        { x: 0.05, y: 0.3, visibility: 0.9 },
        { x: 0.04, y: 1.1, visibility: 0.9 },
        { x: 0.1, y: 0.8, visibility: 0.9 },
      ],
    ]);

    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatchObject({ id: "pose-0" });
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1);
      expect(box.y + box.height).toBeLessThanOrEqual(1);
    }
  });

  it("rejects poses without enough visible landmarks", () => {
    expect(
      poseLandmarksToBoxes([
        [
          { x: 0.2, y: 0.1, visibility: 0.9 },
          { x: 0.4, y: 0.2, visibility: 0.1 },
          { x: 0.3, y: 0.8, visibility: 0.1 },
        ],
      ]),
    ).toEqual([]);
  });
});

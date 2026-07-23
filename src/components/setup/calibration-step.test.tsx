import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoardCorners } from "@/features/board/types";
import { CalibrationStep } from "./calibration-step";

const corners: BoardCorners = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
];

describe("CalibrationStep", () => {
  it("supports keyboard corner adjustment and explicit confirmation", () => {
    const onCornersChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <CalibrationStep
        corners={corners}
        onConfirm={onConfirm}
        onCornersChange={onCornersChange}
        onDetect={vi.fn()}
        rectifiedUrl="data:image/png;base64,rectified"
        sourceUrl="data:image/png;base64,source"
        status="ready"
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Top-left corner" }), {
      key: "ArrowRight",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Use this board frame" }),
    );

    expect(onCornersChange).toHaveBeenCalledWith([
      { x: 0.105, y: 0.1 },
      ...corners.slice(1),
    ]);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

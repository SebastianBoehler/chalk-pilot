import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardCorners } from "@/features/board/types";
import { CalibrationStep } from "./calibration-step";

const corners: BoardCorners = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
];

describe("CalibrationStep", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("matches the handle surface to the camera frame aspect ratio", () => {
    const { rerender } = render(
      <CalibrationStep
        corners={corners}
        onConfirm={vi.fn()}
        onCornersChange={vi.fn()}
        onDetect={vi.fn()}
        rectifiedUrl="data:image/png;base64,rectified"
        sourceSize={{ width: 1_920, height: 1_200 }}
        sourceUrl="data:image/png;base64,source"
        status="ready"
      />,
    );

    const source = screen.getByRole("img", {
      name: "Camera view for board calibration",
    });
    expect(source.parentElement?.getAttribute("style")).toContain(
      "aspect-ratio: 1.6",
    );

    rerender(
      <CalibrationStep
        corners={corners}
        onConfirm={vi.fn()}
        onCornersChange={vi.fn()}
        onDetect={vi.fn()}
        rectifiedUrl="data:image/png;base64,rectified"
        sourceSize={{ width: 3_840, height: 2_160 }}
        sourceUrl="data:image/png;base64,source"
        status="ready"
      />,
    );
    expect(source.parentElement?.getAttribute("style")).toContain(
      "aspect-ratio: 1.7777777777777777",
    );
  });

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
        sourceSize={{ width: 1_920, height: 1_200 }}
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

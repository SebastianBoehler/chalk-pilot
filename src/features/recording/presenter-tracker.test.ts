import { describe, expect, it } from "vitest";
import {
  interpolatePresenterBox,
  presenterCrop,
  selectPresenter,
  updatePresenter,
  type PersonBox,
} from "./presenter-tracker";

const presenter: PersonBox = {
  id: "selected",
  x: 0.12,
  y: 0.18,
  width: 0.16,
  height: 0.54,
};

describe("presenter tracking geometry", () => {
  it("selects only a person underneath the confirmed point", () => {
    const second = { ...presenter, id: "second", x: 0.65 };

    expect(selectPresenter([presenter, second], { x: 0.7, y: 0.4 })).toEqual(
      second,
    );
    expect(() =>
      selectPresenter([presenter, second], { x: 0.5, y: 0.05 }),
    ).toThrow("detected presenter");
  });

  it("associates the nearest person while preserving the selected identity", () => {
    const state = { box: presenter, lossCount: 0, status: "tracking" } as const;
    const nearby = { ...presenter, id: "pose-2", x: 0.15 };
    const distant = { ...presenter, id: "pose-1", x: 0.7 };

    expect(updatePresenter(state, [distant, nearby])).toMatchObject({
      box: { ...nearby, id: "selected" },
      lossCount: 0,
      status: "tracking",
    });
  });

  it("holds the last crop through loss and reacquires only nearby poses", () => {
    const initial = {
      box: presenter,
      lossCount: 0,
      status: "tracking",
    } as const;
    const missing = updatePresenter(initial, []);

    expect(missing).toEqual({
      box: presenter,
      lossCount: 1,
      status: "lost",
    });
    expect(
      updatePresenter(missing, [{ ...presenter, id: "other", x: 0.82 }]),
    ).toEqual({
      box: presenter,
      lossCount: 2,
      status: "lost",
    });
    const candidate = { ...presenter, id: "pose-0", x: 0.14 };
    const pending = updatePresenter(missing, [candidate]);
    expect(pending).toMatchObject({
      box: presenter,
      lossCount: 2,
      status: "lost",
      reacquisition: { count: 1 },
    });
    expect(updatePresenter(pending, [candidate])).toMatchObject({
      box: { id: "selected", x: 0.14 },
      lossCount: 0,
      status: "tracking",
    });
  });

  it("uses motion continuity when two people cross", () => {
    const moving = updatePresenter(
      {
        box: { ...presenter, x: 0.2 },
        lossCount: 0,
        status: "tracking",
      },
      [{ ...presenter, id: "pose-a", x: 0.3 }],
    );
    const selectedContinuingRight = { ...presenter, id: "pose-b", x: 0.39 };
    const crossingLeft = { ...presenter, id: "pose-a", x: 0.27 };

    expect(
      updatePresenter(moving, [crossingLeft, selectedContinuingRight]),
    ).toMatchObject({
      box: { id: "selected", x: 0.39 },
      status: "tracking",
    });
  });

  it("rejects a nearby pose with incompatible scale and shape", () => {
    const state = {
      box: presenter,
      lossCount: 0,
      status: "tracking",
    } as const;
    const nearbyScreenPose = {
      id: "screen",
      x: 0.22,
      y: 0.2,
      width: 0.34,
      height: 0.18,
    };
    const person = { ...presenter, id: "person", x: 0.24 };

    expect(updatePresenter(state, [nearbyScreenPose, person])).toMatchObject({
      box: { id: "selected", x: 0.24, height: presenter.height },
      status: "tracking",
    });
  });

  it("holds the crop when two candidates are similarly plausible", () => {
    const state = {
      box: presenter,
      lossCount: 0,
      status: "tracking",
    } as const;
    const left = { ...presenter, id: "left", x: presenter.x - 0.03 };
    const right = { ...presenter, id: "right", x: presenter.x + 0.03 };

    expect(updatePresenter(state, [left, right])).toMatchObject({
      box: presenter,
      lossCount: 1,
      status: "lost",
    });
  });

  it("requires a stable candidate before reacquiring after loss", () => {
    const lost = {
      box: presenter,
      lossCount: 3,
      status: "lost",
    } as const;
    const first = updatePresenter(lost, [
      { ...presenter, id: "pose-0", x: 0.15 },
    ]);
    const changed = updatePresenter(first, [
      { ...presenter, id: "pose-1", x: 0.28 },
    ]);
    const stable = updatePresenter(changed, [
      { ...presenter, id: "pose-2", x: 0.28 },
    ]);

    expect(first).toMatchObject({
      box: presenter,
      status: "lost",
      reacquisition: { count: 1, box: { x: 0.15 } },
    });
    expect(changed).toMatchObject({
      box: presenter,
      status: "lost",
      reacquisition: { count: 1, box: { x: 0.28 } },
    });
    expect(stable).toMatchObject({
      box: { id: "selected", x: 0.28 },
      status: "tracking",
    });
  });

  it("interpolates every rendered frame with time-based smoothing", () => {
    const target = { ...presenter, x: 0.62 };
    const first = interpolatePresenterBox(presenter, target, 16);
    const longer = interpolatePresenterBox(presenter, target, 80);

    expect(first.x).toBeGreaterThan(presenter.x);
    expect(first.x).toBeLessThan(target.x);
    expect(longer.x).toBeGreaterThan(first.x);
    expect(interpolatePresenterBox(presenter, target, 16).x).toBeCloseTo(
      first.x,
    );
  });

  it.each([
    [1_920, 1_200],
    [3_840, 2_160],
  ])("keeps the %ix%i crop inside the source frame", (width, height) => {
    const crop = presenterCrop(width, height, {
      ...presenter,
      x: 0.94,
      y: 0.8,
    });

    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(width);
    expect(crop.y + crop.height).toBeLessThanOrEqual(height);
    expect(crop.width / crop.height).toBeCloseTo(16 / 9, 1);
  });
});

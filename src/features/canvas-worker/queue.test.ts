// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createKeyedQueue } from "./queue";

describe("canvas job queue", () => {
  it("serializes one session without blocking another session", async () => {
    const queue = createKeyedQueue();
    const order: string[] = [];
    let releaseFirst: () => void = () => {};
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.run("session-1", async () => {
      order.push("first-start");
      await firstGate;
      order.push("first-end");
    });
    const second = queue.run("session-1", async () => {
      order.push("second");
    });
    const other = queue.run("session-2", async () => {
      order.push("other");
    });

    await other;
    expect(order).toEqual(["first-start", "other"]);

    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-start", "other", "first-end", "second"]);
  });
});

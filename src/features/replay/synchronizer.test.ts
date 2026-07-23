import { describe, expect, it, vi } from "vitest";
import { createReplaySynchronizer } from "./synchronizer";

class MediaElementStub extends EventTarget {
  currentTime = 0;
  paused = true;
  playbackRate = 1;
  readonly play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  });
  readonly pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  });
}

describe("createReplaySynchronizer", () => {
  it("shares play, pause, and seeks from the leader", async () => {
    const leader = new MediaElementStub();
    const follower = new MediaElementStub();
    const sync = createReplaySynchronizer(leader, [follower]);

    leader.currentTime = 12;
    await leader.play();
    expect(follower.currentTime).toBe(12);
    expect(follower.play).toHaveBeenCalledOnce();

    leader.currentTime = 18;
    leader.dispatchEvent(new Event("seeking"));
    expect(follower.currentTime).toBe(18);

    leader.pause();
    expect(follower.pause).toHaveBeenCalledOnce();
    sync.destroy();
  });

  it("corrects soft drift with playback rate and hard drift with a seek", () => {
    const leader = new MediaElementStub();
    const soft = new MediaElementStub();
    const hard = new MediaElementStub();
    const sync = createReplaySynchronizer(leader, [soft, hard], {
      softDriftMs: 120,
      hardDriftMs: 500,
    });
    leader.currentTime = 10;
    soft.currentTime = 9.8;
    hard.currentTime = 9;

    sync.syncNow();

    expect(soft.playbackRate).toBeGreaterThan(1);
    expect(hard.currentTime).toBe(10);
    expect(hard.playbackRate).toBe(1);
    sync.destroy();
  });

  it("restores the leader rate once drift is inside the soft threshold", () => {
    const leader = new MediaElementStub();
    const follower = new MediaElementStub();
    const sync = createReplaySynchronizer(leader, [follower]);
    leader.playbackRate = 1.25;
    leader.currentTime = 5;
    follower.currentTime = 4.8;
    sync.syncNow();
    expect(follower.playbackRate).not.toBe(1.25);

    follower.currentTime = 4.95;
    sync.syncNow();

    expect(follower.playbackRate).toBe(1.25);
    sync.destroy();
  });

  it("switches timeline leaders without resetting time or playback", async () => {
    const first = new MediaElementStub();
    const second = new MediaElementStub();
    const third = new MediaElementStub();
    const sync = createReplaySynchronizer(first, [second, third]);
    first.currentTime = 32;
    await first.play();

    sync.setLeader(second, [first, third]);

    expect(second.currentTime).toBe(32);
    expect(second.play).toHaveBeenCalled();
    expect(first.pause).toHaveBeenCalled();
    expect(third.currentTime).toBe(32);
    sync.destroy();
  });

  it("adds a late-mounted follower without replacing the leader", () => {
    const leader = new MediaElementStub();
    const first = new MediaElementStub();
    const late = new MediaElementStub();
    const sync = createReplaySynchronizer(leader, [first]);
    leader.currentTime = 8;

    sync.setLeader(leader, [first, late]);

    expect(late.currentTime).toBe(8);
    sync.destroy();
  });

  it("reports a follower that cannot join playback", async () => {
    const leader = new MediaElementStub();
    const follower = new MediaElementStub();
    const onError = vi.fn();
    follower.play.mockRejectedValueOnce(new Error("media decode failed"));
    const sync = createReplaySynchronizer(leader, [follower], { onError });

    await leader.play();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(
      "A replay track could not start: media decode failed",
    );
    sync.destroy();
  });

  it("removes listeners and timers on cleanup", async () => {
    vi.useFakeTimers();
    const leader = new MediaElementStub();
    const follower = new MediaElementStub();
    const sync = createReplaySynchronizer(leader, [follower]);
    sync.destroy();

    await leader.play();
    vi.advanceTimersByTime(1_000);

    expect(follower.play).not.toHaveBeenCalled();
    expect(follower.currentTime).toBe(0);
    vi.useRealTimers();
  });
});

export interface ReplayMediaElement extends EventTarget {
  currentTime: number;
  paused: boolean;
  playbackRate: number;
  play(): Promise<void>;
  pause(): void;
}

interface ReplaySynchronizerOptions {
  softDriftMs?: number;
  hardDriftMs?: number;
  onError?(message: string): void;
}

export interface ReplaySynchronizer {
  syncNow(): void;
  setLeader(leader: ReplayMediaElement, followers: ReplayMediaElement[]): void;
  destroy(): void;
}

const DEFAULT_SOFT_DRIFT_MS = 120;
const DEFAULT_HARD_DRIFT_MS = 500;
const CORRECTION_RATE = 0.03;

export function createReplaySynchronizer(
  initialLeader: ReplayMediaElement,
  initialFollowers: ReplayMediaElement[],
  options: ReplaySynchronizerOptions = {},
): ReplaySynchronizer {
  let leader = initialLeader;
  let followers = distinctFollowers(initialLeader, initialFollowers);
  let destroyed = false;
  const softDrift = (options.softDriftMs ?? DEFAULT_SOFT_DRIFT_MS) / 1_000;
  const hardDrift = (options.hardDriftMs ?? DEFAULT_HARD_DRIFT_MS) / 1_000;
  const reportPlaybackError = (cause: unknown) => {
    if (!destroyed)
      options.onError?.(
        `A replay track could not start: ${errorMessage(cause)}`,
      );
  };

  const syncSeek = () => {
    for (const follower of followers) {
      follower.currentTime = leader.currentTime;
      follower.playbackRate = leader.playbackRate;
    }
  };
  const syncPlay = () => {
    syncSeek();
    for (const follower of followers) {
      void follower.play().catch(reportPlaybackError);
    }
  };
  const syncPause = () => {
    for (const follower of followers) {
      if (!follower.paused) follower.pause();
      follower.playbackRate = leader.playbackRate;
    }
  };
  const attach = () => {
    leader.addEventListener("play", syncPlay);
    leader.addEventListener("pause", syncPause);
    leader.addEventListener("ended", syncPause);
    leader.addEventListener("seeking", syncSeek);
    leader.addEventListener("ratechange", syncNow);
  };
  const detach = () => {
    leader.removeEventListener("play", syncPlay);
    leader.removeEventListener("pause", syncPause);
    leader.removeEventListener("ended", syncPause);
    leader.removeEventListener("seeking", syncSeek);
    leader.removeEventListener("ratechange", syncNow);
  };
  function syncNow() {
    if (destroyed) return;
    for (const follower of followers) {
      const drift = leader.currentTime - follower.currentTime;
      const magnitude = Math.abs(drift);
      if (magnitude >= hardDrift) {
        follower.currentTime = leader.currentTime;
        follower.playbackRate = leader.playbackRate;
      } else if (magnitude >= softDrift) {
        follower.playbackRate =
          leader.playbackRate + Math.sign(drift) * CORRECTION_RATE;
      } else {
        follower.playbackRate = leader.playbackRate;
      }
    }
  }

  attach();
  const timer = setInterval(syncNow, 250);
  return {
    syncNow,
    setLeader(nextLeader, nextFollowers) {
      if (destroyed) return;
      if (nextLeader === leader) {
        followers = distinctFollowers(nextLeader, nextFollowers);
        syncSeek();
        return;
      }
      const time = leader.currentTime;
      const rate = leader.playbackRate;
      const paused = leader.paused;
      detach();
      if (!paused) leader.pause();
      leader = nextLeader;
      followers = distinctFollowers(nextLeader, nextFollowers);
      leader.currentTime = time;
      leader.playbackRate = rate;
      attach();
      syncSeek();
      if (!paused) void leader.play().catch(reportPlaybackError);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      detach();
      clearInterval(timer);
      for (const follower of followers) {
        follower.playbackRate = 1;
      }
    },
  };
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "unknown media error";
}

function distinctFollowers(
  leader: ReplayMediaElement,
  followers: ReplayMediaElement[],
) {
  return [...new Set(followers)].filter((candidate) => candidate !== leader);
}

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
      align(follower);
    }
  };
  const syncPlay = () => {
    syncSeek();
    for (const follower of followers) {
      start(follower);
    }
  };
  const syncPause = () => {
    for (const follower of followers) {
      pause(follower);
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
  function align(element: ReplayMediaElement) {
    element.currentTime = leader.currentTime;
    element.playbackRate = leader.playbackRate;
  }
  function start(element: ReplayMediaElement) {
    if (element.paused) void element.play().catch(reportPlaybackError);
  }
  function pause(element: ReplayMediaElement) {
    if (!element.paused) element.pause();
  }
  function retire(element: ReplayMediaElement) {
    pause(element);
    element.playbackRate = 1;
  }
  function updateFollowers(nextFollowers: ReplayMediaElement[]) {
    const next = distinctFollowers(leader, nextFollowers);
    const removed = followers.filter((element) => !next.includes(element));
    const added = next.filter((element) => !followers.includes(element));
    for (const element of removed) retire(element);
    followers = next;
    for (const element of added) {
      align(element);
      if (leader.paused) pause(element);
      else start(element);
    }
  }

  attach();
  const timer = setInterval(syncNow, 250);
  return {
    syncNow,
    setLeader(nextLeader, nextFollowers) {
      if (destroyed) return;
      if (nextLeader === leader) {
        updateFollowers(nextFollowers);
        return;
      }
      const time = leader.currentTime;
      const rate = leader.playbackRate;
      const wasPlaying = !leader.paused;
      const previousFollowers = followers;
      detach();
      leader = nextLeader;
      followers = distinctFollowers(nextLeader, nextFollowers);
      for (const removed of previousFollowers.filter(
        (element) => element !== nextLeader && !followers.includes(element),
      )) {
        retire(removed);
      }
      leader.currentTime = time;
      leader.playbackRate = rate;
      attach();
      syncSeek();
      if (wasPlaying) {
        start(leader);
        for (const follower of followers) start(follower);
      } else {
        pause(leader);
        syncPause();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      detach();
      clearInterval(timer);
      for (const follower of followers) {
        retire(follower);
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

import type { AgentState } from "@/features/display/protocol";

export interface SessionState {
  sessionId: string;
  camera: "pending" | "ready" | "lost";
  display: "connected" | "lost";
  realtime: "connecting" | "connected" | "disconnected" | "error";
  agentState: AgentState;
  paused: boolean;
  canSendBoard: boolean;
  needsDisplayReopen: boolean;
}

export type SessionAction =
  | { type: "camera_ready" }
  | { type: "camera_lost" }
  | { type: "display_connected" }
  | { type: "display_lost" }
  | { type: "realtime_connected" }
  | { type: "realtime_lost" }
  | { type: "realtime_error" }
  | { type: "agent_state"; state: AgentState }
  | { type: "paused"; paused: boolean };

export function createSessionState(sessionId: string): SessionState {
  return derive({
    sessionId,
    camera: "pending",
    display: "lost",
    realtime: "connecting",
    agentState: "idle",
    paused: false,
    canSendBoard: false,
    needsDisplayReopen: true,
  });
}

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "camera_ready":
      return derive({ ...state, camera: "ready" });
    case "camera_lost":
      return derive({ ...state, camera: "lost" });
    case "display_connected":
      return derive({ ...state, display: "connected" });
    case "display_lost":
      return derive({ ...state, display: "lost" });
    case "realtime_connected":
      return derive({ ...state, realtime: "connected" });
    case "realtime_lost":
      return derive({
        ...state,
        realtime: "disconnected",
        agentState: "error",
      });
    case "realtime_error":
      return derive({ ...state, realtime: "error", agentState: "error" });
    case "agent_state":
      return derive({ ...state, agentState: action.state });
    case "paused":
      return derive({
        ...state,
        paused: action.paused,
        agentState: action.paused ? "paused" : "listening",
      });
  }
}

function derive(state: SessionState): SessionState {
  return {
    ...state,
    canSendBoard:
      state.camera === "ready" &&
      state.realtime === "connected" &&
      !state.paused,
    needsDisplayReopen: state.display !== "connected",
  };
}

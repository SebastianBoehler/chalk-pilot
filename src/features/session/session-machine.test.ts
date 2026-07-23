import { describe, expect, it } from "vitest";
import { createSessionState, sessionReducer } from "./session-machine";

describe("session machine", () => {
  it("pauses board sending when the camera is lost", () => {
    let state = createSessionState("session-1");
    state = sessionReducer(state, { type: "realtime_connected" });
    state = sessionReducer(state, { type: "camera_ready" });
    expect(state.canSendBoard).toBe(true);

    state = sessionReducer(state, { type: "camera_lost" });
    expect(state.canSendBoard).toBe(false);
    expect(state.sessionId).toBe("session-1");
  });

  it("preserves the local session and exposes display recovery", () => {
    let state = createSessionState("session-2");
    state = sessionReducer(state, { type: "display_connected" });
    state = sessionReducer(state, { type: "display_lost" });
    state = sessionReducer(state, { type: "realtime_lost" });

    expect(state.sessionId).toBe("session-2");
    expect(state.needsDisplayReopen).toBe(true);
    expect(state.realtime).toBe("disconnected");
  });
});

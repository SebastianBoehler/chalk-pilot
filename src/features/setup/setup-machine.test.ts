import { describe, expect, it } from "vitest";
import { initialSetupState, setupReducer, setupReady } from "./setup-machine";

describe("setup machine", () => {
  it("requires camera, calibration, and OpenAI readiness", () => {
    let state = initialSetupState;

    state = setupReducer(state, { type: "camera_ready" });
    state = setupReducer(state, { type: "advance" });
    expect(state.step).toBe("calibration");

    state = setupReducer(state, { type: "advance" });
    expect(state.step).toBe("calibration");
    state = setupReducer(state, { type: "calibration_confirmed" });
    state = setupReducer(state, { type: "advance" });
    expect(state.step).toBe("preview");
    state = setupReducer(state, { type: "advance" });
    expect(state.step).toBe("ready");
    expect(setupReady(state)).toBe(false);

    state = setupReducer(state, { type: "openai_ready" });
    expect(setupReady(state)).toBe(true);
  });

  it("keeps setup ready when the optional clean display closes", () => {
    const ready = {
      ...initialSetupState,
      step: "ready" as const,
      camera: "ready" as const,
      calibration: "confirmed" as const,
      display: "connected" as const,
      openai: "ready" as const,
    };

    const lost = setupReducer(ready, { type: "display_lost" });

    expect(lost.display).toBe("closed");
    expect(lost.calibration).toBe("confirmed");
    expect(setupReady(lost)).toBe(true);
  });
});

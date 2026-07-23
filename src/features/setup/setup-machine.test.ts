import { describe, expect, it } from "vitest";
import { initialSetupState, setupReducer, setupReady } from "./setup-machine";

describe("setup machine", () => {
  it("requires microphone confirmation between camera and calibration", () => {
    let state = initialSetupState;

    state = setupReducer(state, { type: "camera_ready" });
    state = setupReducer(state, {
      type: "camera_use_selected",
      cameraUse: "room-wide",
    });
    state = setupReducer(state, { type: "advance" });
    expect(state.step).toBe("microphone");

    state = setupReducer(state, { type: "advance" });
    expect(state.step).toBe("microphone");
    state = setupReducer(state, { type: "microphone_confirmed" });
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

  it("does not report ready without a confirmed microphone", () => {
    expect(
      setupReady({
        ...initialSetupState,
        step: "ready",
        camera: "ready",
        calibration: "confirmed",
        openai: "ready",
      }),
    ).toBe(false);
  });

  it("does not leave camera setup until a camera use is selected", () => {
    let state = setupReducer(initialSetupState, { type: "camera_ready" });

    state = setupReducer(state, { type: "advance" });
    expect(state.step).toBe("camera");

    state = setupReducer(state, {
      type: "camera_use_selected",
      cameraUse: "board-focused",
    });
    state = setupReducer(state, { type: "advance" });
    expect(state.step).toBe("microphone");
    expect(state.cameraUse).toBe("board-focused");
  });

  it("keeps setup ready when the optional clean display closes", () => {
    const ready = {
      ...initialSetupState,
      step: "ready" as const,
      camera: "ready" as const,
      cameraUse: "room-wide" as const,
      microphone: "confirmed" as const,
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

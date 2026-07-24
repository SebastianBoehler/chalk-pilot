import { describe, expect, it } from "vitest";
import { initialSetupState, setupReducer, setupReady } from "./setup-machine";

describe("setup machine", () => {
  it("requires an explicit material choice before camera setup", () => {
    expect(setupReducer(initialSetupState, { type: "advance" }).step).toBe(
      "context",
    );

    const selected = setupReducer(initialSetupState, {
      type: "context_selected",
    });
    expect(setupReducer(selected, { type: "advance" }).step).toBe("camera");

    const skipped = setupReducer(initialSetupState, {
      type: "context_skipped",
    });
    expect(setupReducer(skipped, { type: "advance" }).step).toBe("camera");
  });

  it("requires microphone confirmation between camera and calibration", () => {
    let state = enterCamera();

    state = setupReducer(state, { type: "camera_ready" });
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

  it("uses fixed-camera behavior by default and advances after camera access", () => {
    let state = setupReducer(enterCamera(), { type: "camera_ready" });

    state = setupReducer(state, { type: "advance" });
    expect(state.step).toBe("microphone");
    expect(state.cameraUse).toBe("board-focused");
  });

  it("returns from camera setup to the material choice", () => {
    expect(setupReducer(enterCamera(), { type: "back" }).step).toBe("context");
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

function enterCamera() {
  return setupReducer(
    setupReducer(initialSetupState, { type: "context_skipped" }),
    { type: "advance" },
  );
}

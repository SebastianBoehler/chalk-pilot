export type SetupStep = "camera" | "calibration" | "display" | "ready";

export interface SetupState {
  step: SetupStep;
  camera: "pending" | "ready" | "error";
  calibration: "pending" | "confirmed";
  display: "closed" | "connected";
  openai: "checking" | "ready" | "error";
}

export type SetupAction =
  | { type: "camera_ready" }
  | { type: "camera_error" }
  | { type: "calibration_confirmed" }
  | { type: "display_connected" }
  | { type: "display_lost" }
  | { type: "openai_ready" }
  | { type: "openai_error" }
  | { type: "recalibrate" }
  | { type: "advance" }
  | { type: "back" };

export const initialSetupState: SetupState = {
  step: "camera",
  camera: "pending",
  calibration: "pending",
  display: "closed",
  openai: "checking",
};

export function setupReducer(
  state: SetupState,
  action: SetupAction,
): SetupState {
  switch (action.type) {
    case "camera_ready":
      return { ...state, camera: "ready" };
    case "camera_error":
      return { ...state, camera: "error" };
    case "calibration_confirmed":
      return { ...state, calibration: "confirmed" };
    case "display_connected":
      return { ...state, display: "connected" };
    case "display_lost":
      return { ...state, display: "closed" };
    case "openai_ready":
      return { ...state, openai: "ready" };
    case "openai_error":
      return { ...state, openai: "error" };
    case "recalibrate":
      return { ...state, step: "calibration", calibration: "pending" };
    case "advance":
      return advance(state);
    case "back":
      return {
        ...state,
        step: (
          {
            camera: "camera",
            calibration: "camera",
            display: "calibration",
            ready: "display",
          } satisfies Record<SetupStep, SetupStep>
        )[state.step],
      };
  }
}

export function setupReady(state: SetupState) {
  return (
    state.camera === "ready" &&
    state.calibration === "confirmed" &&
    state.display === "connected" &&
    state.openai === "ready"
  );
}

function advance(state: SetupState): SetupState {
  if (state.step === "camera" && state.camera === "ready") {
    return { ...state, step: "calibration" };
  }
  if (state.step === "calibration" && state.calibration === "confirmed") {
    return { ...state, step: "display" };
  }
  if (state.step === "display" && state.display === "connected") {
    return { ...state, step: "ready" };
  }
  return state;
}

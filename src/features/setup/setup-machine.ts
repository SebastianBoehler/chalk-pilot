import type { CameraUse } from "./camera-use";

export type SetupStep =
  "camera" | "microphone" | "calibration" | "preview" | "ready";

export interface SetupState {
  step: SetupStep;
  camera: "pending" | "ready" | "error";
  cameraUse: CameraUse | "pending";
  microphone: "pending" | "confirmed" | "error";
  calibration: "pending" | "confirmed";
  display: "closed" | "connected";
  openai: "checking" | "ready" | "error";
}

export type SetupAction =
  | { type: "camera_ready" }
  | { type: "camera_error" }
  | { type: "camera_use_selected"; cameraUse: CameraUse }
  | { type: "microphone_confirmed" }
  | { type: "microphone_error" }
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
  cameraUse: "pending",
  microphone: "pending",
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
    case "camera_use_selected":
      return { ...state, cameraUse: action.cameraUse };
    case "microphone_confirmed":
      return { ...state, microphone: "confirmed" };
    case "microphone_error":
      return { ...state, microphone: "error" };
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
            microphone: "camera",
            calibration: "microphone",
            preview: "calibration",
            ready: "preview",
          } satisfies Record<SetupStep, SetupStep>
        )[state.step],
      };
  }
}

export function setupReady(state: SetupState) {
  return (
    state.camera === "ready" &&
    state.cameraUse !== "pending" &&
    state.microphone === "confirmed" &&
    state.calibration === "confirmed" &&
    state.openai === "ready"
  );
}

function advance(state: SetupState): SetupState {
  if (
    state.step === "camera" &&
    state.camera === "ready" &&
    state.cameraUse !== "pending"
  ) {
    return { ...state, step: "microphone" };
  }
  if (state.step === "microphone" && state.microphone === "confirmed") {
    return { ...state, step: "calibration" };
  }
  if (state.step === "calibration" && state.calibration === "confirmed") {
    return { ...state, step: "preview" };
  }
  if (state.step === "preview") {
    return { ...state, step: "ready" };
  }
  return state;
}

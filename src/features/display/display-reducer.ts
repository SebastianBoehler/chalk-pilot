import type { CanvasState } from "@/features/workspace/schema";
import type { AgentState, DisplayMessage } from "./protocol";

export type { DisplayMessage } from "./protocol";

export interface DisplayState {
  canvas: CanvasState;
  agentState: AgentState;
  synchronized: boolean;
}

export const emptyDisplayState: DisplayState = {
  canvas: {
    version: 1,
    focusId: null,
    order: [],
    sections: {},
  },
  agentState: "idle",
  synchronized: false,
};

export function reduceDisplayState(
  state: DisplayState,
  message: DisplayMessage,
): DisplayState {
  switch (message.type) {
    case "ready":
      return state;
    case "snapshot":
      return { ...message.payload, synchronized: true };
    case "canvas":
      return { ...state, canvas: message.payload, synchronized: true };
    case "agent_state":
      return { ...state, agentState: message.payload };
  }
}

import { vi } from "vitest";
import type { CanvasNavigation } from "./schema";
import type { CanvasState } from "@/features/workspace/schema";

const timestamp = "2026-07-24T10:00:00.000Z";

export const canvas: CanvasState = {
  version: 1,
  focusId: null,
  order: ["idea", "steps", "check", "trend"],
  sections: {
    idea: {
      id: "idea",
      kind: "flow",
      title: "Pressure mechanism",
      data: {
        orientation: "horizontal",
        nodes: [
          {
            id: "pressure",
            title: "Pressure",
            detail: "A pressure difference moves fluid.",
          },
        ],
        edges: [],
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    steps: {
      id: "steps",
      kind: "sequence",
      title: "Procedure",
      data: {
        steps: [
          { id: "measure", title: "Measure", content: "Read **the** scale." },
        ],
        activeStepId: "measure",
        reveal: "all",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    check: {
      id: "check",
      kind: "checkpoint",
      title: "Prediction",
      data: {
        mode: "prediction",
        prompt: "What happens next?",
        status: "unanswered",
        showHint: false,
        showAnswer: false,
        showFeedback: false,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    trend: {
      id: "trend",
      kind: "chart",
      title: "Pressure trend",
      data: {
        variant: "line",
        series: [{ name: "Pressure", points: [{ x: 1, y: 2 }] }],
        annotations: [{ id: "threshold", x: 1, y: 2, label: "Threshold" }],
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
};

export function nav(
  requestId: string,
  targetId: string,
  options: Partial<CanvasNavigation> = {},
): CanvasNavigation {
  return {
    requestId,
    targetId,
    kind: "focus",
    issuedAt: timestamp,
    ...options,
  };
}

export function mockScrollIntoView() {
  const scrollIntoView = vi.fn();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  return scrollIntoView;
}

export function resetCanvasNavigationDom() {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  delete (globalThis as { CSS?: unknown }).CSS;
  delete (globalThis as { Highlight?: unknown }).Highlight;
  document.querySelector("#chalkpilot-canvas-highlight-style")?.remove();
}

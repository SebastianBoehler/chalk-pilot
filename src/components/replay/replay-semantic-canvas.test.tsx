import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockScrollIntoView } from "@/features/canvas-navigation/test-helpers";
import type { CanvasState } from "@/features/workspace/schema";
import { ReplaySemanticCanvas } from "./replay-semantic-canvas";

const timestamp = "2026-07-23T10:00:00.000Z";

function canvas(title: string): CanvasState {
  return {
    version: 1,
    focusId: "concept",
    order: ["concept"],
    sections: {
      concept: {
        id: "concept",
        kind: "markdown",
        title,
        content: `${title} explanation`,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
  };
}

describe("ReplaySemanticCanvas", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("restores the latest semantic canvas revision at the current offset", () => {
    const events = [
      { type: "canvas" as const, offsetMs: 0, revision: canvas("First") },
      {
        type: "canvas" as const,
        offsetMs: 2_500,
        revision: canvas("Second"),
      },
    ];
    const { rerender } = render(
      <ReplaySemanticCanvas
        currentMs={0}
        events={events}
        navigationEvents={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "First" })).toBeVisible();

    rerender(
      <ReplaySemanticCanvas
        currentMs={3_000}
        events={events}
        navigationEvents={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Second" })).toBeVisible();
  });

  it("replays navigation without retriggering it for a later canvas revision", () => {
    const scrollIntoView = mockScrollIntoView();
    const events = [
      { type: "canvas" as const, offsetMs: 0, revision: canvas("First") },
      {
        type: "canvas" as const,
        offsetMs: 2_500,
        revision: canvas("Second"),
      },
    ];
    const navigationEvents = [
      {
        type: "navigation" as const,
        offsetMs: 1_500,
        navigation: {
          requestId: "navigation-1",
          targetId: "concept",
          kind: "focus" as const,
          issuedAt: timestamp,
        },
      },
    ];
    const { rerender } = render(
      <ReplaySemanticCanvas
        currentMs={1_000}
        events={events}
        navigationEvents={navigationEvents}
      />,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(
      <ReplaySemanticCanvas
        currentMs={2_000}
        events={events}
        navigationEvents={navigationEvents}
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledOnce();

    rerender(
      <ReplaySemanticCanvas
        currentMs={3_000}
        events={events}
        navigationEvents={navigationEvents}
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it("uses the last stored canvas revision at an equal offset", () => {
    render(
      <ReplaySemanticCanvas
        currentMs={1_000}
        events={[
          { type: "canvas", offsetMs: 1_000, revision: canvas("First") },
          { type: "canvas", offsetMs: 1_000, revision: canvas("Second") },
        ]}
        navigationEvents={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Second" })).toBeVisible();
  });

  it("uses the last stored navigation request at an equal offset", () => {
    const scrollIntoView = mockScrollIntoView();
    const { rerender } = render(
      <ReplaySemanticCanvas
        currentMs={0}
        events={[
          {
            type: "canvas",
            offsetMs: 0,
            revision: {
              ...canvas("Concept"),
              order: ["first", "second"],
              sections: {
                first: { ...canvas("First").sections.concept, id: "first" },
                second: { ...canvas("Second").sections.concept, id: "second" },
              },
            },
          },
        ]}
        navigationEvents={[]}
      />,
    );

    rerender(
      <ReplaySemanticCanvas
        currentMs={1_000}
        events={[
          {
            type: "canvas",
            offsetMs: 0,
            revision: {
              ...canvas("Concept"),
              order: ["first", "second"],
              sections: {
                first: { ...canvas("First").sections.concept, id: "first" },
                second: { ...canvas("Second").sections.concept, id: "second" },
              },
            },
          },
        ]}
        navigationEvents={[
          {
            type: "navigation",
            offsetMs: 1_000,
            navigation: {
              requestId: "navigation-first",
              targetId: "first",
              kind: "focus",
              issuedAt: timestamp,
            },
          },
          {
            type: "navigation",
            offsetMs: 1_000,
            navigation: {
              requestId: "navigation-second",
              targetId: "second",
              kind: "focus",
              issuedAt: timestamp,
            },
          },
        ]}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledOnce();
    const target = scrollIntoView.mock.instances[0] as HTMLElement | undefined;
    expect(target?.dataset.canvasTarget).toBe("second");
  });
});

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentationCanvas } from "@/components/canvas/presentation-canvas";
import {
  canvas,
  mockScrollIntoView,
  nav,
  resetCanvasNavigationDom,
} from "./test-helpers";

afterEach(() => {
  resetCanvasNavigationDom();
});

describe("canvas navigation", () => {
  it("scrolls an explicit request once and replays only a new request id", () => {
    const scrollIntoView = mockScrollIntoView();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );

    const view = render(
      <PresentationCanvas canvas={canvas} navigation={nav("nav-1", "idea")} />,
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });

    view.rerender(
      <PresentationCanvas
        canvas={{ ...canvas }}
        navigation={nav("nav-1", "idea")}
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    view.rerender(
      <PresentationCanvas canvas={canvas} navigation={nav("nav-2", "idea")} />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("renders only registry-backed nested anchors", () => {
    const { container } = render(<PresentationCanvas canvas={canvas} />);

    expect(
      Array.from(container.querySelectorAll("[data-canvas-target]")).map(
        (element) => element.getAttribute("data-canvas-target"),
      ),
    ).toEqual([
      "idea",
      "idea:pressure",
      "steps",
      "steps:measure",
      "check",
      "check:prompt",
      "trend",
      "trend:threshold",
    ]);
  });

  it("reports unavailable targets without scrolling", () => {
    const onNavigationFailure = vi.fn();
    const scrollIntoView = mockScrollIntoView();

    render(
      <PresentationCanvas
        canvas={canvas}
        navigation={nav("nav-1", "missing")}
        onNavigationFailure={onNavigationFailure}
      />,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(onNavigationFailure).toHaveBeenCalledWith(
      "Canvas target is unavailable.",
    );
  });

  it("uses reduced-motion scrolling and clears attention after five seconds", () => {
    vi.useFakeTimers();
    const scrollIntoView = mockScrollIntoView();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );

    const { container } = render(
      <PresentationCanvas canvas={canvas} navigation={nav("nav-1", "idea")} />,
    );
    const target = container.querySelector('[data-canvas-target="idea"]');
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "center",
    });
    expect(target).toHaveAttribute("data-canvas-attention", "focus");

    vi.advanceTimersByTime(5_000);
    expect(target).not.toHaveAttribute("data-canvas-attention");
  });

  it("highlights exact rendered text only inside the resolved target", () => {
    mockScrollIntoView();
    const highlights = new Map();
    const set = vi.spyOn(highlights, "set");
    vi.stubGlobal("CSS", { highlights });
    vi.stubGlobal(
      "Highlight",
      class Highlight {
        constructor(readonly range: Range) {}
      },
    );
    const onNavigationFailure = vi.fn();

    render(
      <PresentationCanvas
        canvas={canvas}
        navigation={nav("nav-1", "idea:pressure", {
          kind: "highlight",
          text: "A pressure difference",
        })}
        onNavigationFailure={onNavigationFailure}
      />,
    );

    expect(set).toHaveBeenCalledOnce();
    expect(set.mock.calls[0]?.[1]).toBeInstanceOf(Highlight);
    expect(onNavigationFailure).not.toHaveBeenCalled();
  });

  it("reports unavailable highlight text after scrolling and pulsing its target", () => {
    const scrollIntoView = mockScrollIntoView();
    const onNavigationFailure = vi.fn();

    const { container } = render(
      <PresentationCanvas
        canvas={canvas}
        navigation={nav("nav-1", "idea:pressure", {
          kind: "highlight",
          text: "Not rendered here.",
        })}
        onNavigationFailure={onNavigationFailure}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(
      container.querySelector('[data-canvas-target="idea:pressure"]'),
    ).toHaveAttribute("data-canvas-attention", "highlight");
    expect(onNavigationFailure).toHaveBeenCalledWith(
      "Highlight text is unavailable.",
    );
  });

  it("reports missing highlight text after scrolling and pulsing its target", () => {
    const scrollIntoView = mockScrollIntoView();
    const onNavigationFailure = vi.fn();

    const { container } = render(
      <PresentationCanvas
        canvas={canvas}
        navigation={nav("nav-1", "idea:pressure", { kind: "highlight" })}
        onNavigationFailure={onNavigationFailure}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(
      container.querySelector('[data-canvas-target="idea:pressure"]'),
    ).toHaveAttribute("data-canvas-attention", "highlight");
    expect(onNavigationFailure).toHaveBeenCalledOnce();
    expect(onNavigationFailure).toHaveBeenCalledWith(
      "Highlight text is unavailable.",
    );
  });

  it("registers a descendant-spanning range and cleans it on replacement, expiry, and unmount", () => {
    vi.useFakeTimers();
    mockScrollIntoView();
    const highlights = new Map();
    const remove = vi.spyOn(highlights, "delete");
    vi.stubGlobal("CSS", { highlights });
    vi.stubGlobal(
      "Highlight",
      class Highlight {
        constructor(readonly range: Range) {}
      },
    );

    const view = render(
      <PresentationCanvas
        canvas={canvas}
        navigation={nav("nav-1", "steps:measure", {
          kind: "highlight",
          text: "Read the scale.",
        })}
      />,
    );
    const firstHighlight = highlights.values().next().value as {
      range: Range;
    };
    expect(firstHighlight.range.toString()).toBe("Read the scale.");

    view.rerender(
      <PresentationCanvas
        canvas={canvas}
        navigation={nav("nav-2", "idea:pressure", {
          kind: "highlight",
          text: "Pressure",
        })}
      />,
    );
    expect(remove).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);
    expect(remove).toHaveBeenCalledTimes(2);

    view.unmount();
    expect(remove).toHaveBeenCalledTimes(3);
  });
});

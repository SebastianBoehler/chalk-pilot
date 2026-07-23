import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { PresentationCanvas } from "./presentation-canvas";

const timestamp = "2026-07-23T10:00:00.000Z";

describe("PresentationCanvas", () => {
  it("renders focused learning content without executable HTML", () => {
    const canvas: CanvasState = {
      version: 1,
      focusId: "idea",
      order: ["idea"],
      sections: {
        idea: {
          id: "idea",
          kind: "markdown",
          title: "Key idea",
          content:
            "Use **retrieval** first. <script>alert('no')</script> [unsafe](javascript:alert(1))",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    };

    const { container } = render(<PresentationCanvas canvas={canvas} />);

    expect(
      screen.getByRole("heading", { name: "Key idea" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Current focus")).toBeInTheDocument();
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(
      container.querySelector('a[href^="javascript:"]'),
    ).not.toBeInTheDocument();
  });

  it("embeds only a normalized YouTube video", () => {
    const canvas: CanvasState = {
      version: 1,
      focusId: null,
      order: ["video"],
      sections: {
        video: {
          id: "video",
          kind: "youtube",
          title: "Watch the mechanism",
          content: "https://youtu.be/dQw4w9WgXcQ",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    };

    render(<PresentationCanvas canvas={canvas} />);

    expect(screen.getByTitle("Watch the mechanism")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
});

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
    expect(screen.queryByText("Current focus")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Key idea" }).closest("section"),
    ).toHaveAttribute("aria-current", "true");
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

  it("renders canonical source provenance and keeps uncited sections clean", () => {
    const canvas: CanvasState = {
      version: 1,
      focusId: "grounded",
      order: ["grounded", "general"],
      sections: {
        grounded: {
          id: "grounded",
          kind: "markdown",
          title: "Course definition",
          content: "Reverse KL can prefer one mode.",
          citations: [
            {
              chunkId: "lecture-4-c-1",
              sourceTitle: "Lecture 4",
              locator: "Page 12",
            },
          ],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        general: {
          id: "general",
          kind: "markdown",
          title: "Supplemental intuition",
          content: "Think of a narrow searchlight.",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    };

    render(<PresentationCanvas canvas={canvas} />);

    expect(screen.getByLabelText("Sources")).toHaveTextContent(
      "Source: Lecture 4, Page 12",
    );
    expect(
      screen
        .getByRole("heading", { name: "Supplemental intuition" })
        .closest("section")
        ?.querySelector('[aria-label="Sources"]'),
    ).toBeNull();
  });

  it("renders every trusted structured artifact without executable HTML", () => {
    const canvas: CanvasState = {
      version: 1,
      focusId: "sequence",
      order: ["chart", "comparison", "sequence", "checkpoint"],
      sections: {
        chart: {
          id: "chart",
          kind: "chart",
          title: "Recall over practice",
          data: {
            variant: "bar",
            series: [{ name: "Recall", points: [{ x: "One", y: 4 }] }],
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        comparison: {
          id: "comparison",
          kind: "comparison",
          title: "Token choices",
          data: {
            columns: [
              {
                heading: "Word",
                summary: "Whole words.",
                points: ["Simple"],
              },
              {
                heading: "Subword",
                summary: "Reusable pieces.",
                points: ["Flexible"],
              },
            ],
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        sequence: {
          id: "sequence",
          kind: "sequence",
          title: "From text to vectors",
          data: {
            steps: [
              { id: "split", title: "Split", content: "Create tokens." },
              { id: "look-up", title: "Look up", content: "Use embeddings." },
            ],
            activeStepId: "split",
            reveal: "active",
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        checkpoint: {
          id: "checkpoint",
          kind: "checkpoint",
          title: "Prediction",
          data: {
            mode: "prediction",
            prompt: "Predict the next step.",
            status: "unanswered",
            showHint: false,
            showAnswer: false,
            showFeedback: false,
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    };

    const { container } = render(<PresentationCanvas canvas={canvas} />);

    expect(
      screen.getByRole("img", { name: "Recall over practice" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Learning sequence" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Prediction checkpoint" }),
    ).toBeInTheDocument();
    expect(container.querySelector("script")).not.toBeInTheDocument();
  });
});

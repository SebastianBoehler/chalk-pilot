import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  ChartArtifactData,
  CheckpointArtifactData,
  ComparisonArtifactData,
  FlowArtifactData,
  SequenceArtifactData,
} from "@/features/workspace/artifact-schemas";
import { ArtifactErrorBoundary } from "./artifact-error-boundary";
import { ChartArtifact } from "./chart-artifact";
import { CheckpointArtifact } from "./checkpoint-artifact";
import { ComparisonArtifact } from "./comparison-artifact";
import { FlowArtifact } from "./flow-artifact";
import { SequenceArtifact } from "./sequence-artifact";

const chart: ChartArtifactData = {
  variant: "line",
  xLabel: "Practice round",
  yLabel: "Recall score",
  series: [
    {
      name: "Recall",
      points: [
        { x: 1, y: 42 },
        { x: 2, y: 66 },
        { x: 3, y: 83 },
      ],
    },
  ],
  annotations: [{ x: 2, y: 66, label: "First retrieval" }],
};

const comparison: ComparisonArtifactData = {
  columns: [
    {
      heading: "Word",
      summary: "Treats complete words as one unit.",
      points: ["Intuitive", "Large vocabulary"],
      emphasis: "neutral",
    },
    {
      heading: "Subword",
      summary: "Breaks rare words into reusable pieces.",
      points: ["Flexible", "Less intuitive"],
      emphasis: "positive",
    },
  ],
};

const sequence: SequenceArtifactData = {
  steps: [
    { id: "tokenize", title: "Tokenize", content: "Split the text." },
    { id: "embed", title: "Embed", content: "Look up a vector." },
    { id: "predict", title: "Predict", content: "Use the model output." },
  ],
  activeStepId: "embed",
  reveal: "through-active",
};

const flow: FlowArtifactData = {
  orientation: "horizontal",
  nodes: [
    { id: "evidence", title: "Evidence", detail: "Observe what changes." },
    {
      id: "mechanism",
      title: "Mechanism",
      detail: "<script>never execute</script>",
    },
    { id: "outcome", title: "Outcome" },
  ],
  edges: [
    { from: "evidence", to: "mechanism", label: "constrains" },
    { from: "mechanism", to: "outcome", label: "produces" },
  ],
  activeNodeId: "mechanism",
};

const checkpoint: CheckpointArtifactData = {
  mode: "prediction",
  prompt: "Which tokenization choice handles unseen words best?",
  choices: ["Word", "Subword", "Character"],
  hint: "Reuse smaller familiar units.",
  expectedAnswer: "Subword tokenization.",
  feedback: "It balances vocabulary size and flexibility.",
  status: "attempted",
  showHint: true,
  showAnswer: false,
  showFeedback: false,
};

describe("trusted structured learning artifacts", () => {
  it("keeps categorical bars within the plot for one and many categories", () => {
    const cases: ChartArtifactData[] = [
      {
        variant: "bar",
        series: [{ name: "One", points: [{ x: "Only", y: 3 }] }],
      },
      {
        variant: "bar",
        series: [
          {
            name: "Many",
            points: [
              { x: "First", y: 3 },
              { x: "Second", y: 4 },
              { x: "Third", y: 5 },
            ],
          },
        ],
      },
      {
        variant: "bar",
        series: [
          {
            name: "Dense",
            points: Array.from({ length: 100 }, (_, index) => ({
              x: `Category ${index + 1}`,
              y: index + 1,
            })),
          },
        ],
      },
    ];

    for (const data of cases) {
      const { container, unmount } = render(
        <ChartArtifact data={data} title="Categorical bars" />,
      );
      const bars = Array.from(container.querySelectorAll("svg rect")).map(
        (bar) => ({
          width: Number(bar.getAttribute("width")),
          x: Number(bar.getAttribute("x")),
        }),
      );
      unmount();

      expect(bars).toHaveLength(data.series[0]?.points.length ?? 0);
      for (const bar of bars) {
        expect(bar.x).toBeGreaterThanOrEqual(78);
        expect(bar.x + bar.width).toBeLessThanOrEqual(766);
      }
    }
  });

  it("uses the same categorical band center for ticks and annotations", () => {
    const { container, unmount } = render(
      <ChartArtifact
        data={{
          variant: "bar",
          series: [{ name: "Recall", points: [{ x: "Only", y: 3 }] }],
          annotations: [{ x: "Only", label: "Review" }],
        }}
        title="Categorical annotation"
      />,
    );
    const tick = Array.from(container.querySelectorAll("svg text")).find(
      (node) => node.textContent === "Only",
    );
    const annotation = container.querySelector('svg line[stroke="#171916"]');
    const annotationX = annotation?.getAttribute("x1");
    unmount();

    expect(tick).toHaveAttribute("x", annotationX);
  });

  it("renders a chart as an accessible, application-generated SVG", () => {
    render(
      <ChartArtifact data={chart} title="Recall improves with practice" />,
    );

    expect(
      screen.getByRole("img", { name: "Recall improves with practice" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Practice round")).toBeInTheDocument();
    expect(screen.getByText("Recall score")).toBeInTheDocument();
    expect(screen.getByText("First retrieval")).toBeInTheDocument();
    expect(document.querySelectorAll("svg line").length).toBeGreaterThan(3);
    expect(document.querySelector("svg path")).toBeInTheDocument();
    const baseline = screen.getByTestId("chart-baseline");
    expect(Number(baseline.getAttribute("y1"))).toBeGreaterThanOrEqual(34);
    expect(Number(baseline.getAttribute("y1"))).toBeLessThanOrEqual(366);
  });

  it("renders comparisons as one semantic matrix rather than prose cards", () => {
    const view = render(
      <ComparisonArtifact
        data={{
          ...comparison,
          columns: [
            {
              ...comparison.columns[0],
              summary:
                "Always works for $ax^2+bx+c=0$. $$x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$",
              points: ["Compute $D=b^2-4ac$ first."],
            },
            comparison.columns[1]!,
          ],
        }}
      />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Word" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Subword" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Summary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Breaks rare words into reusable pieces."),
    ).toBeInTheDocument();
    expect(view.container.querySelectorAll(".katex").length).toBeGreaterThan(1);
  });

  it("renders a layered concept flow with visible relationships and active state", () => {
    const view = render(<FlowArtifact data={flow} />);

    expect(
      screen.getByRole("region", { name: "Concept flow" }),
    ).toHaveAttribute("data-orientation", "horizontal");
    expect(screen.getByTestId("flow-layout")).toHaveClass("flex-col");
    expect(screen.getByTestId("flow-layout")).toHaveClass("2xl:flex-row");
    expect(screen.getByRole("article", { name: "Mechanism" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByText("constrains")).toBeInTheDocument();
    expect(screen.getByText("produces")).toBeInTheDocument();
    const firstRelationship = document.querySelector(
      '[data-flow-from="evidence"][data-flow-to="mechanism"]',
    );
    expect(firstRelationship).toHaveTextContent("Evidence");
    expect(firstRelationship).toHaveTextContent("Mechanism");
    expect(
      firstRelationship?.querySelectorAll("[data-flow-endpoint]"),
    ).toHaveLength(2);
    expect(
      screen.getByText("<script>never execute</script>"),
    ).toBeInTheDocument();
    expect(document.querySelector("script")).not.toBeInTheDocument();

    view.rerender(<FlowArtifact data={{ ...flow, orientation: "vertical" }} />);

    expect(
      screen.getByRole("region", { name: "Concept flow" }),
    ).toHaveAttribute("data-orientation", "vertical");
  });

  it("keeps unrevealed sequence content out of the document and renders revealed Markdown safely", () => {
    render(
      <SequenceArtifact
        data={{
          ...sequence,
          steps: [
            {
              ...sequence.steps[0],
              content:
                "Split **the text** safely. <script>alert('no')</script>",
            },
            ...sequence.steps.slice(1),
          ],
        }}
      />,
    );

    expect(screen.getByText("the text").tagName).toBe("STRONG");
    expect(screen.getByText("Look up a vector.")).toBeInTheDocument();
    expect(screen.queryByText("Use the model output.")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Step \d/)).toHaveLength(3);
    expect(document.querySelector("script")).not.toBeInTheDocument();
  });

  it("shows checkpoint guidance only when the data explicitly reveals it", () => {
    render(<CheckpointArtifact data={checkpoint} />);

    expect(
      screen.getByRole("region", { name: "Prediction checkpoint" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Reuse smaller familiar units."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Subword tokenization.")).not.toBeInTheDocument();
    expect(screen.queryByText("Attempt in progress")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Pause and make a prediction"),
    ).not.toBeInTheDocument();
  });

  it("isolates a failing artifact and recovers when its section changes", () => {
    function CrashingArtifact({ crash }: { crash: boolean }) {
      if (crash) throw new Error("bad artifact");
      return <p>Recovered artifact</p>;
    }

    const view = render(
      <ArtifactErrorBoundary resetKey="first">
        <CrashingArtifact crash />
      </ArtifactErrorBoundary>,
    );

    expect(
      screen.getByText("This learning artifact is unavailable."),
    ).toBeInTheDocument();

    view.rerender(
      <ArtifactErrorBoundary resetKey="second">
        <CrashingArtifact crash={false} />
      </ArtifactErrorBoundary>,
    );

    expect(screen.getByText("Recovered artifact")).toBeInTheDocument();
  });
});

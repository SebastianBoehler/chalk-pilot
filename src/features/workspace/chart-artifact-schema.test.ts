import { describe, expect, it } from "vitest";
import { chartArtifactDataSchema } from "./artifact-schemas";

describe("chart artifact schema", () => {
  it("accepts bounded finite chart data and validated annotation IDs", () => {
    const result = chartArtifactDataSchema.parse({
      variant: "scatter",
      xLabel: "Token position",
      yLabel: "Embedding component",
      series: [
        {
          name: "Words",
          points: [
            { x: 1, y: 0.2 },
            { x: 2, y: 0.8, label: "context" },
          ],
        },
      ],
      annotations: [
        { id: "contrast", x: 2, y: 0.8, label: "A useful contrast" },
      ],
    });

    expect(result.series[0]?.points).toHaveLength(2);
    expect(result.annotations?.[0]?.id).toBe("contrast");
    expect(() =>
      chartArtifactDataSchema.parse({
        variant: "line",
        series: [{ name: "Loss", points: [{ x: 2, y: 0.2 }] }],
        annotations: [{ id: "minimum:loss", x: 2, label: "Minimum loss" }],
      }),
    ).toThrow(/identifier/i);
  });

  it("rejects duplicate provided annotation IDs", () => {
    expect(() =>
      chartArtifactDataSchema.parse({
        variant: "line",
        series: [
          {
            name: "Loss",
            points: [
              { x: 1, y: 0.4 },
              { x: 2, y: 0.2 },
            ],
          },
        ],
        annotations: [
          { id: "minimum", x: 1, label: "First marker" },
          { id: "minimum", x: 2, label: "Second marker" },
        ],
      }),
    ).toThrow(/unique/i);
  });

  it("rejects invalid ranges, non-finite values, and executable fields", () => {
    const chart = {
      variant: "line",
      series: [{ name: "Loss", points: [{ x: 1, y: 0.4 }] }],
    };

    expect(() =>
      chartArtifactDataSchema.parse({
        ...chart,
        annotations: [{ x: 99, label: "not a plotted value" }],
      }),
    ).toThrow();
    expect(() =>
      chartArtifactDataSchema.parse({
        ...chart,
        annotations: [{ x: "1", label: "a different axis value" }],
      }),
    ).toThrow();
    expect(() =>
      chartArtifactDataSchema.parse({
        ...chart,
        series: [{ name: "Loss", points: [{ x: 1, y: Infinity }] }],
      }),
    ).toThrow();
    expect(() =>
      chartArtifactDataSchema.parse({ ...chart, svg: "<svg />" }),
    ).toThrow();
    expect(() =>
      chartArtifactDataSchema.parse({
        ...chart,
        series: [
          {
            name: "Loss",
            points: [
              { x: -1e308, y: -1e308 },
              { x: 1e308, y: 1e308 },
            ],
          },
        ],
      }),
    ).toThrow(/representable scale/i);
    expect(() =>
      chartArtifactDataSchema.parse({
        ...chart,
        series: [
          {
            name: "Loss",
            points: [{ x: Number.MAX_VALUE, y: Number.MAX_VALUE }],
          },
        ],
      }),
    ).toThrow(/representable scale/i);
    expect(() =>
      chartArtifactDataSchema.parse({
        ...chart,
        annotations: [{ x: 1, y: Number.MAX_VALUE, label: "Out of range" }],
      }),
    ).toThrow(/representable scale/i);
  });
});

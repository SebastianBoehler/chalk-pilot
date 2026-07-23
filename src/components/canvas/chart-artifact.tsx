import { useId } from "react";
import type { ChartArtifactData } from "@/features/workspace/artifact-schemas";

const WIDTH = 800;
const HEIGHT = 440;
const MARGIN = { top: 34, right: 34, bottom: 74, left: 78 };
const COLORS = ["#155eef", "#18794e", "#9333ea", "#c4320a"];

type ChartPoint = ChartArtifactData["series"][number]["points"][number];

function numericRange(values: number[]) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) {
    const padding = Math.max(Math.abs(minimum) * 0.1, 1);
    return [minimum - padding, maximum + padding] as const;
  }
  const padding = (maximum - minimum) * 0.1;
  return [minimum - padding, maximum + padding] as const;
}

function tickValues(minimum: number, maximum: number) {
  return Array.from(
    { length: 5 },
    (_, index) => minimum + ((maximum - minimum) * index) / 4,
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function xValue(point: ChartPoint) {
  return typeof point.x === "number" ? point.x : String(point.x);
}

export function ChartArtifact({
  data,
  title,
}: {
  data: ChartArtifactData;
  title: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const points = data.series.flatMap((series) => series.points);
  const numericX = points.every((point) => typeof point.x === "number");
  const categories = Array.from(
    new Set(points.map((point) => String(point.x))),
  );
  const [xMinimum, xMaximum] = numericX
    ? numericRange(points.map((point) => Number(point.x)))
    : [0, Math.max(categories.length - 1, 1)];
  const yValues = points.map((point) => point.y);
  const yMinimum =
    data.variant === "bar" ? Math.min(0, ...yValues) : Math.min(...yValues);
  const yMaximum =
    data.variant === "bar" ? Math.max(0, ...yValues) : Math.max(...yValues);
  const [yStart, yEnd] = numericRange([yMinimum, yMaximum]);
  const chartWidth = WIDTH - MARGIN.left - MARGIN.right;
  const chartHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const xCoordinate = (value: ChartPoint["x"]) => {
    const numericValue = numericX
      ? Number(value)
      : categories.indexOf(String(value));
    return (
      MARGIN.left +
      ((numericValue - xMinimum) / (xMaximum - xMinimum)) * chartWidth
    );
  };
  const yCoordinate = (value: number) =>
    MARGIN.top + ((yEnd - value) / (yEnd - yStart)) * chartHeight;
  const xTicks = numericX
    ? tickValues(xMinimum, xMaximum)
    : categories.slice(0, 12).map((label) => categories.indexOf(label));
  const baseline =
    data.variant === "bar" ? yCoordinate(0) : yCoordinate(yStart);
  const barGroupWidth = chartWidth / Math.max(categories.length, 1);
  const barWidth = Math.max(
    8,
    Math.min(42, (barGroupWidth * 0.72) / data.series.length),
  );

  return (
    <figure aria-label={title} className="space-y-4">
      <svg
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="border-border bg-surface-muted w-full rounded-2xl border"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <title id={titleId}>{title}</title>
        <desc id={descriptionId}>
          {data.variant} chart with {data.series.length} data series.
        </desc>
        {tickValues(yStart, yEnd).map((tick) => (
          <g key={tick}>
            <line
              stroke="#d9d7cf"
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={yCoordinate(tick)}
              y2={yCoordinate(tick)}
            />
            <text
              fill="#676b63"
              fontSize="14"
              textAnchor="end"
              x={MARGIN.left - 12}
              y={yCoordinate(tick) + 5}
            >
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        <line
          data-testid="chart-baseline"
          stroke="#676b63"
          x1={MARGIN.left}
          x2={WIDTH - MARGIN.right}
          y1={baseline}
          y2={baseline}
        />
        {xTicks.map((tick) => {
          const label = numericX
            ? formatNumber(tick)
            : (categories[tick] ?? "");
          const coordinate =
            MARGIN.left +
            ((tick - xMinimum) / (xMaximum - xMinimum)) * chartWidth;
          return (
            <text
              fill="#676b63"
              fontSize="14"
              key={`${label}-${tick}`}
              textAnchor="middle"
              x={coordinate}
              y={HEIGHT - MARGIN.bottom + 30}
            >
              {label}
            </text>
          );
        })}
        {data.variant === "bar" &&
          data.series.map((series, seriesIndex) =>
            series.points.map((point, pointIndex) => {
              const center = xCoordinate(point.x);
              const height = Math.abs(yCoordinate(point.y) - baseline);
              return (
                <rect
                  fill={COLORS[seriesIndex]}
                  height={height}
                  key={`${series.name}-${pointIndex}`}
                  rx="4"
                  width={barWidth}
                  x={
                    center -
                    (data.series.length * barWidth) / 2 +
                    seriesIndex * barWidth
                  }
                  y={Math.min(yCoordinate(point.y), baseline)}
                />
              );
            }),
          )}
        {data.variant === "line" &&
          data.series.map((series, seriesIndex) => {
            const d = series.points
              .map(
                (point, pointIndex) =>
                  `${pointIndex === 0 ? "M" : "L"}${xCoordinate(point.x)} ${yCoordinate(point.y)}`,
              )
              .join(" ");
            return (
              <g key={series.name}>
                <path
                  d={d}
                  fill="none"
                  stroke={COLORS[seriesIndex]}
                  strokeWidth="4"
                />
                {series.points.map((point, pointIndex) => (
                  <circle
                    cx={xCoordinate(point.x)}
                    cy={yCoordinate(point.y)}
                    fill={COLORS[seriesIndex]}
                    key={pointIndex}
                    r="5"
                  />
                ))}
              </g>
            );
          })}
        {data.variant === "scatter" &&
          data.series.map((series, seriesIndex) =>
            series.points.map((point, pointIndex) => (
              <circle
                cx={xCoordinate(point.x)}
                cy={yCoordinate(point.y)}
                fill={COLORS[seriesIndex]}
                key={`${series.name}-${pointIndex}`}
                r="7"
              />
            )),
          )}
        {data.annotations?.map((annotation) => {
          const matchingPoint = points.find((point) =>
            Object.is(xValue(point), annotation.x),
          );
          const annotationY = annotation.y ?? matchingPoint?.y ?? yEnd;
          return (
            <g key={annotation.label}>
              <line
                stroke="#171916"
                strokeDasharray="4 4"
                x1={xCoordinate(annotation.x)}
                x2={xCoordinate(annotation.x)}
                y1={MARGIN.top}
                y2={yCoordinate(annotationY)}
              />
              <text
                fill="#171916"
                fontSize="14"
                fontWeight="600"
                x={xCoordinate(annotation.x) + 8}
                y={Math.max(MARGIN.top + 16, yCoordinate(annotationY) - 8)}
              >
                {annotation.label}
              </text>
            </g>
          );
        })}
        {data.xLabel && (
          <text
            fill="#171916"
            fontSize="16"
            fontWeight="600"
            textAnchor="middle"
            x={WIDTH / 2}
            y={HEIGHT - 18}
          >
            {data.xLabel}
          </text>
        )}
        {data.yLabel && (
          <text
            fill="#171916"
            fontSize="16"
            fontWeight="600"
            textAnchor="middle"
            transform={`translate(22 ${HEIGHT / 2}) rotate(-90)`}
          >
            {data.yLabel}
          </text>
        )}
      </svg>
      <ul aria-label="Chart legend" className="flex flex-wrap gap-x-5 gap-y-2">
        {data.series.map((series, index) => (
          <li
            className="flex items-center gap-2 text-sm font-semibold"
            key={series.name}
          >
            <span
              aria-hidden="true"
              className="size-3 rounded-full"
              style={{ backgroundColor: COLORS[index] }}
            />
            {series.name}
          </li>
        ))}
      </ul>
    </figure>
  );
}

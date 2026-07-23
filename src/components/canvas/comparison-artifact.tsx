import type { ComparisonArtifactData } from "@/features/workspace/artifact-schemas";

const emphasisClasses = {
  neutral: "bg-surface",
  positive: "bg-success/10",
  caution: "bg-danger/10",
};

export function ComparisonArtifact({ data }: { data: ComparisonArtifactData }) {
  return (
    <div className="border-border overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-[38rem] border-collapse text-left">
        <thead>
          <tr>
            <th className="bg-surface-muted border-border w-40 border-b p-4 text-base font-semibold">
              Compare
            </th>
            {data.columns.map((column) => (
              <th
                className={`border-border min-w-52 border-b p-4 text-lg font-semibold ${emphasisClasses[column.emphasis ?? "neutral"]}`}
                key={column.heading}
                scope="col"
              >
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th
              className="bg-surface-muted border-border border-b p-4 align-top font-semibold"
              scope="row"
            >
              Summary
            </th>
            {data.columns.map((column) => (
              <td
                className="border-border border-b p-4 align-top leading-relaxed"
                key={column.heading}
              >
                {column.summary}
              </td>
            ))}
          </tr>
          <tr>
            <th
              className="bg-surface-muted p-4 align-top font-semibold"
              scope="row"
            >
              Key points
            </th>
            {data.columns.map((column) => (
              <td className="p-4 align-top" key={column.heading}>
                <ul className="list-disc space-y-2 pl-5">
                  {column.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

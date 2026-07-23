import type { CheckpointArtifactData } from "@/features/workspace/artifact-schemas";

const statusCopy = {
  unanswered: "Pause and make a prediction",
  attempted: "Attempt in progress",
  correct: "Correct",
  revise: "Try a different route",
};

const statusClasses = {
  unanswered: "bg-primary/10 text-primary",
  attempted: "bg-surface-muted text-foreground",
  correct: "bg-success/10 text-success",
  revise: "bg-danger/10 text-danger",
};

export function CheckpointArtifact({ data }: { data: CheckpointArtifactData }) {
  return (
    <section
      aria-label={`${data.mode[0].toUpperCase()}${data.mode.slice(1)} checkpoint`}
      className="border-primary/30 bg-primary/5 rounded-2xl border p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold">Checkpoint</p>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClasses[data.status]}`}
        >
          {statusCopy[data.status]}
        </span>
      </div>
      <h3 className="mt-5 max-w-3xl text-2xl font-semibold tracking-tight">
        {data.prompt}
      </h3>
      {data.choices && (
        <ol className="mt-5 grid gap-3 md:grid-cols-2">
          {data.choices.map((choice, index) => (
            <li
              className="border-border bg-surface rounded-xl border px-4 py-3"
              key={choice}
            >
              <span className="text-muted mr-3 font-semibold">
                {index + 1}.
              </span>
              {choice}
            </li>
          ))}
        </ol>
      )}
      {data.showHint && data.hint && (
        <div className="border-primary/20 bg-surface mt-5 rounded-xl border p-4">
          <h4 className="font-semibold">Hint</h4>
          <p className="mt-1 leading-relaxed">{data.hint}</p>
        </div>
      )}
      {data.showAnswer && data.expectedAnswer && (
        <div className="border-success/20 bg-success/10 mt-5 rounded-xl border p-4">
          <h4 className="text-success font-semibold">Answer</h4>
          <p className="mt-1 leading-relaxed">{data.expectedAnswer}</p>
        </div>
      )}
      {data.showFeedback && data.feedback && (
        <div className="border-border bg-surface mt-5 rounded-xl border p-4">
          <h4 className="font-semibold">Why this matters</h4>
          <p className="mt-1 leading-relaxed">{data.feedback}</p>
        </div>
      )}
    </section>
  );
}

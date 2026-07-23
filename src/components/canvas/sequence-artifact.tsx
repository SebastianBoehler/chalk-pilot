import type { SequenceArtifactData } from "@/features/workspace/artifact-schemas";
import { SafeMarkdown } from "./safe-markdown";

function isRevealed(
  index: number,
  activeIndex: number,
  reveal: SequenceArtifactData["reveal"],
) {
  return (
    reveal === "all" ||
    (reveal === "through-active" && index <= activeIndex) ||
    (reveal === "active" && index === activeIndex)
  );
}

export function SequenceArtifact({ data }: { data: SequenceArtifactData }) {
  const activeIndex = data.steps.findIndex(
    ({ id }) => id === data.activeStepId,
  );

  return (
    <ol
      aria-label="Learning sequence"
      className="flex flex-col gap-4 md:flex-row md:gap-0"
    >
      {data.steps.map((step, index) => {
        const revealed = isRevealed(index, activeIndex, data.reveal);
        const active = index === activeIndex;
        return (
          <li
            aria-current={active ? "step" : undefined}
            className={`relative flex-1 rounded-2xl border p-5 md:mx-2 ${
              active
                ? "border-primary bg-primary/10"
                : revealed
                  ? "border-border bg-surface"
                  : "border-border bg-surface-muted text-muted"
            }`}
            key={step.id}
          >
            <span className="bg-foreground text-surface mb-4 grid size-8 place-items-center rounded-full text-sm font-bold">
              {index + 1}
            </span>
            <p className="text-sm font-semibold">Step {index + 1}</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">
              {step.title}
            </h3>
            {revealed ? (
              <div className="learning-content mt-3 text-base leading-relaxed">
                <SafeMarkdown>{step.content}</SafeMarkdown>
              </div>
            ) : (
              <p className="mt-3 text-sm">Keep working to reveal this step.</p>
            )}
            {index < data.steps.length - 1 && (
              <span
                aria-hidden="true"
                className="bg-border after:border-l-border absolute top-9 -right-4 hidden h-0.5 w-8 after:absolute after:-top-[5px] after:-right-1 after:border-y-[5px] after:border-l-[7px] after:border-y-transparent after:content-[''] md:block"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

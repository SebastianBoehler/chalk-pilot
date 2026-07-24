import { PresentationCanvas } from "@/components/canvas/presentation-canvas";
import type { ReplayTimeline } from "@/features/recording/schema";
import { selectTimelineEvent } from "./replay-timeline-selection";

export function ReplaySemanticCanvas({
  events,
  navigationEvents,
  currentMs,
}: {
  events: ReplayTimeline["canvasEvents"];
  navigationEvents: ReplayTimeline["navigationEvents"];
  currentMs: number;
}) {
  const revision = selectTimelineEvent(events, currentMs)?.revision;
  const navigation = selectTimelineEvent(
    navigationEvents,
    currentMs,
  )?.navigation;

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-2xl font-semibold">Canvas at this moment</h2>
      {revision ? (
        <PresentationCanvas canvas={revision} navigation={navigation} />
      ) : (
        <div className="border-border bg-surface rounded-2xl border p-6">
          <p className="text-muted">
            No semantic canvas revision exists at this point.
          </p>
        </div>
      )}
    </section>
  );
}

import type { CanvasState } from "@/features/workspace/schema";
import { CanvasSection } from "./canvas-section";

export function PresentationCanvas({ canvas }: { canvas: CanvasState }) {
  if (canvas.order.length === 0) {
    return (
      <div className="grid min-h-[55vh] place-items-center text-center">
        <div>
          <h2 className="text-4xl font-semibold tracking-tight">
            Start at the board.
          </h2>
          <p className="text-muted mt-3 text-xl">
            ChalkPilot will place durable context here as you learn.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {canvas.order.map((id) => {
        const section = canvas.sections[id];
        return section ? (
          <CanvasSection
            focused={id === canvas.focusId}
            key={id}
            section={section}
          />
        ) : null;
      })}
    </div>
  );
}

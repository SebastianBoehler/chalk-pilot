"use client";

import { useEffect, useId, useRef, useState } from "react";

type RenderState =
  | { source: string; status: "error" }
  | { source: string; status: "ready"; svg: string };

export function MermaidBlock({ source }: { source: string }) {
  const id = useId().replace(/:/g, "");
  const renderCount = useRef(0);
  const [renderState, setRenderState] = useState<RenderState>();
  const currentRender =
    renderState?.source === source ? renderState : undefined;

  useEffect(() => {
    let active = true;
    const renderId = `chalkpilot-${id}-${++renderCount.current}`;
    const removeTemporaryNode = () => {
      document.getElementById(`d${renderId}`)?.remove();
    };

    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        });
        const parsed = await mermaid.parse(source, { suppressErrors: true });
        if (!active) return;
        if (!parsed) {
          setRenderState({ source, status: "error" });
          return;
        }

        const result = await mermaid.render(renderId, source);
        removeTemporaryNode();
        if (active)
          setRenderState({ source, status: "ready", svg: result.svg });
      })
      .catch(() => {
        removeTemporaryNode();
        if (active) setRenderState({ source, status: "error" });
      });
    return () => {
      active = false;
      removeTemporaryNode();
    };
  }, [id, source]);

  if (currentRender?.status === "error") {
    return <p className="text-danger">This diagram could not be rendered.</p>;
  }
  if (currentRender?.status !== "ready") {
    return <p className="text-muted">Rendering diagram…</p>;
  }
  return (
    <div
      className="overflow-x-auto [&_svg]:mx-auto [&_svg]:max-h-[60vh]"
      dangerouslySetInnerHTML={{ __html: currentRender.svg }}
    />
  );
}

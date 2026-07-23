"use client";

import { useEffect, useId, useRef, useState } from "react";

export function MermaidBlock({ source }: { source: string }) {
  const id = useId().replace(/:/g, "");
  const renderCount = useRef(0);
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    const renderId = `chalkpilot-${id}-${++renderCount.current}`;
    const removeTemporaryNode = () => {
      document.getElementById(`d${renderId}`)?.remove();
    };

    setSvg(undefined);
    setError(undefined);

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
          setError("This diagram could not be rendered.");
          return;
        }

        const result = await mermaid.render(renderId, source);
        removeTemporaryNode();
        if (active) setSvg(result.svg);
      })
      .catch(() => {
        removeTemporaryNode();
        if (active) setError("This diagram could not be rendered.");
      });
    return () => {
      active = false;
      removeTemporaryNode();
    };
  }, [id, source]);

  if (error) return <p className="text-danger">{error}</p>;
  if (!svg) return <p className="text-muted">Rendering diagram…</p>;
  return (
    <div
      className="overflow-x-auto [&_svg]:mx-auto [&_svg]:max-h-[60vh]"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

"use client";

import { useEffect, useId, useState } from "react";

export function MermaidBlock({ source }: { source: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        });
        const result = await mermaid.render(`chalkpilot-${id}`, source);
        if (active) setSvg(result.svg);
      })
      .catch(() => {
        if (active) setError("This diagram could not be rendered.");
      });
    return () => {
      active = false;
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

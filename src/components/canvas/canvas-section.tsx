import Image from "next/image";
import type { CanvasSection as CanvasSectionModel } from "@/features/workspace/schema";
import { youtubeEmbedUrl } from "@/features/display/media";
import { ArtifactErrorBoundary } from "./artifact-error-boundary";
import { ChartArtifact } from "./chart-artifact";
import { CheckpointArtifact } from "./checkpoint-artifact";
import { ComparisonArtifact } from "./comparison-artifact";
import { FlowArtifact } from "./flow-artifact";
import { MermaidBlock } from "./mermaid-block";
import { SafeMarkdown } from "./safe-markdown";
import { SequenceArtifact } from "./sequence-artifact";

export function CanvasSection({
  section,
  focused,
}: {
  section: CanvasSectionModel;
  focused: boolean;
}) {
  return (
    <section
      aria-current={focused ? "true" : undefined}
      className={`bg-surface rounded-3xl border px-8 py-7 shadow-sm transition ${
        focused ? "border-primary ring-primary/10 ring-4" : "border-border"
      }`}
      data-canvas-target={section.id}
    >
      <header className="mb-5">
        <h2 className="text-3xl font-semibold tracking-tight">
          {section.title}
        </h2>
      </header>
      <ArtifactErrorBoundary resetKey={`${section.id}:${section.updatedAt}`}>
        <SectionContent section={section} />
      </ArtifactErrorBoundary>
    </section>
  );
}

function SectionContent({ section }: { section: CanvasSectionModel }) {
  if (section.kind === "chart")
    return (
      <ChartArtifact
        data={section.data}
        sectionId={section.id}
        title={section.title}
      />
    );
  if (section.kind === "comparison")
    return <ComparisonArtifact data={section.data} />;
  if (section.kind === "flow")
    return <FlowArtifact data={section.data} sectionId={section.id} />;
  if (section.kind === "sequence")
    return <SequenceArtifact data={section.data} sectionId={section.id} />;
  if (section.kind === "checkpoint")
    return <CheckpointArtifact data={section.data} sectionId={section.id} />;
  if (!("content" in section)) {
    return <p className="text-muted">This learning artifact is unavailable.</p>;
  }
  if (section.kind === "mermaid")
    return <MermaidBlock source={section.content} />;
  if (section.kind === "image") {
    return (
      <div className="bg-surface-muted relative min-h-[20rem] overflow-hidden rounded-2xl">
        <Image
          alt={section.title}
          className="object-contain"
          fill
          sizes="90vw"
          src={section.content}
          unoptimized
        />
      </div>
    );
  }
  if (section.kind === "youtube") {
    const source = youtubeEmbedUrl(section.content);
    if (!source)
      return <p className="text-danger">This video URL is invalid.</p>;
    return (
      <iframe
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-2xl border-0"
        referrerPolicy="strict-origin-when-cross-origin"
        src={source}
        title={section.title}
      />
    );
  }
  const content =
    section.kind === "math" ? `$$${section.content}$$` : section.content;
  return (
    <div className="learning-content text-foreground max-w-none">
      <SafeMarkdown>{content}</SafeMarkdown>
    </div>
  );
}

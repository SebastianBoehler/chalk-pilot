import Image from "next/image";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { CanvasSection as CanvasSectionModel } from "@/features/workspace/schema";
import { youtubeEmbedUrl } from "@/features/display/media";
import { MermaidBlock } from "./mermaid-block";

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
    >
      <header className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-3xl font-semibold tracking-tight">
          {section.title}
        </h2>
        {focused && (
          <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-semibold">
            Current focus
          </span>
        )}
      </header>
      <SectionContent section={section} />
    </section>
  );
}

function SectionContent({ section }: { section: CanvasSectionModel }) {
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
    <div className="prose prose-xl text-foreground max-w-none">
      <ReactMarkdown
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

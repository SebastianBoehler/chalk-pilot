import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export function SafeMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeKatex]}
      remarkPlugins={[remarkGfm, remarkMath]}
    >
      {normalizeDisplayMath(children)}
    </ReactMarkdown>
  );
}

function normalizeDisplayMath(source: string) {
  return source.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (_match, expression: string) => `\n\n$$\n${expression.trim()}\n$$\n\n`,
  );
}

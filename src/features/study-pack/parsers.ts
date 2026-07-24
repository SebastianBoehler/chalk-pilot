import { extname } from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import { extractText } from "unpdf";
import {
  MAX_PDF_PAGES,
  type ParsedStudySource,
  type StudyBlock,
  type StudySourceFormat,
  type StudyUpload,
} from "./schema";

export class StudySourceParseError extends Error {}

export async function parseStudySource(
  upload: StudyUpload,
): Promise<ParsedStudySource> {
  const format = resolveFormat(upload.fileName, upload.mimeType);
  if (format === "pdf") return parsePdf(upload.bytes);
  const text = decodeText(upload.bytes);
  return {
    format,
    blocks: format === "markdown" ? parseMarkdown(text) : parsePlainText(text),
  };
}

export function resolveFormat(
  fileName: string,
  mimeType: string,
): StudySourceFormat {
  const extension = extname(fileName).toLowerCase();
  if (extension === ".pdf" && mimeType === "application/pdf") return "pdf";
  if (
    [".md", ".markdown"].includes(extension) &&
    ["text/markdown", "text/plain", "application/octet-stream"].includes(
      mimeType,
    )
  )
    return "markdown";
  if (
    extension === ".txt" &&
    ["text/plain", "application/octet-stream"].includes(mimeType)
  )
    return "text";
  throw new StudySourceParseError("Use a PDF, Markdown, or plain text file.");
}

async function parsePdf(bytes: Uint8Array): Promise<ParsedStudySource> {
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new StudySourceParseError("The uploaded PDF is invalid.");
  }
  const extracted = await extractText(bytes);
  if (extracted.totalPages > MAX_PDF_PAGES) {
    throw new StudySourceParseError(
      `PDFs may contain at most ${MAX_PDF_PAGES} pages.`,
    );
  }
  const pages = Array.isArray(extracted.text)
    ? extracted.text
    : [extracted.text];
  const blocks = pages
    .map((text, index) => ({
      locator: `p. ${index + 1}`,
      text: text.replace(/\s+/g, " ").trim(),
    }))
    .filter(({ text }) => text.length > 0);
  if (blocks.reduce((length, block) => length + block.text.length, 0) < 32) {
    throw new StudySourceParseError(
      "No extractable text was found. Scanned PDFs are not supported yet.",
    );
  }
  return { format: "pdf", blocks };
}

function parseMarkdown(source: string): StudyBlock[] {
  const root = fromMarkdown(source);
  const headings: string[] = [];
  const groups: StudyBlock[] = [];
  let current: StudyBlock = { locator: "Introduction", text: "" };
  for (const node of root.children) {
    if (node.type === "heading") {
      flush(groups, current);
      headings.splice(node.depth - 1);
      headings[node.depth - 1] = toString(node).trim();
      current = {
        locator: `${headings.filter(Boolean).join(" > ")} (line ${node.position?.start.line ?? 1})`,
        text: "",
      };
      continue;
    }
    const text = toString(node).trim();
    if (text) current.text += `${current.text ? "\n\n" : ""}${text}`;
  }
  flush(groups, current);
  if (!groups.length)
    throw new StudySourceParseError("The Markdown file is empty.");
  return groups;
}

function parsePlainText(source: string): StudyBlock[] {
  const paragraphs = source
    .split(/\n\s*\n/)
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!paragraphs.length)
    throw new StudySourceParseError("The text file is empty.");
  return paragraphs.map((text, index) => ({
    locator: `Paragraph ${index + 1}`,
    text,
  }));
}

function decodeText(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new StudySourceParseError("The file must use UTF-8 text.");
  }
}

function flush(blocks: StudyBlock[], block: StudyBlock) {
  const text = block.text.trim();
  if (text) blocks.push({ ...block, text });
}

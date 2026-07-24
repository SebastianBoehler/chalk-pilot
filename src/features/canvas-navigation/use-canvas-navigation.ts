import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { CanvasNavigation } from "./schema";
import { findExactRenderedTextRange } from "./text-range";

const ATTENTION_DURATION_MS = 5_000;
const HIGHLIGHT_NAME = "canvas-navigation";
const HIGHLIGHT_STYLE_ID = "chalkpilot-canvas-highlight-style";

type HighlightRegistry = {
  delete: (name: string) => boolean;
  set: (name: string, highlight: unknown) => unknown;
};

type HighlightConstructor = new (range: Range) => unknown;

function registerHighlight(range: Range) {
  const css = globalThis.CSS as
    | (typeof CSS & {
        highlights?: HighlightRegistry;
      })
    | undefined;
  const Highlight = globalThis.Highlight as HighlightConstructor | undefined;
  if (!css?.highlights || !Highlight) return () => {};

  const document = range.startContainer.ownerDocument;
  if (document) installHighlightStyle(document);
  css.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
  return () => {
    css.highlights?.delete(HIGHLIGHT_NAME);
  };
}

function installHighlightStyle(document: Document) {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `::highlight(${HIGHLIGHT_NAME}) {
    background: color-mix(in srgb, var(--focus) 45%, transparent);
    color: var(--foreground);
  }`;
  document.head.append(style);
}

function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function useCanvasNavigation(
  containerRef: RefObject<HTMLElement | null>,
  navigation: CanvasNavigation | null | undefined,
  onFailure?: (message: string) => void,
) {
  const navigationRef = useRef(navigation);
  const onFailureRef = useRef(onFailure);
  const requestId = navigation?.requestId;

  useEffect(() => {
    navigationRef.current = navigation;
    onFailureRef.current = onFailure;
  });

  useEffect(() => {
    const container = containerRef.current;
    const currentNavigation = navigationRef.current;
    if (!container || !currentNavigation) return;

    const target = Array.from(
      container.querySelectorAll<HTMLElement>("[data-canvas-target]"),
    ).find(
      (element) => element.dataset.canvasTarget === currentNavigation?.targetId,
    );
    if (!target) {
      onFailureRef.current?.("Canvas target is unavailable.");
      return;
    }

    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
    target.dataset.canvasAttention = currentNavigation.kind;

    const clearHighlight =
      currentNavigation.kind === "highlight"
        ? highlightTargetText(
            target,
            currentNavigation.text,
            onFailureRef.current,
          )
        : () => {};
    const expire = () => {
      target.removeAttribute("data-canvas-attention");
      clearHighlight();
    };
    const timeout = window.setTimeout(expire, ATTENTION_DURATION_MS);

    return () => {
      window.clearTimeout(timeout);
      expire();
    };
  }, [containerRef, requestId]);
}

function highlightTargetText(
  target: HTMLElement,
  text: string | undefined,
  onFailure?: (message: string) => void,
) {
  if (!text) {
    onFailure?.("Highlight text is unavailable.");
    return () => {};
  }
  const range = findExactRenderedTextRange(target, text);
  if (!range) {
    onFailure?.("Highlight text is unavailable.");
    return () => {};
  }
  return registerHighlight(range);
}

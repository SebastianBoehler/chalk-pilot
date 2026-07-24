import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { CanvasNavigation } from "./schema";
import { findExactRenderedTextRange } from "./text-range";

const ATTENTION_DURATION_MS = 5_000;
const HIGHLIGHT_NAME = "canvas-navigation";

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

  css.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
  return () => {
    css.highlights?.delete(HIGHLIGHT_NAME);
  };
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
      currentNavigation.kind === "highlight" && currentNavigation.text
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
  text: string,
  onFailure?: (message: string) => void,
) {
  const range = findExactRenderedTextRange(target, text);
  if (!range) {
    onFailure?.("Highlight text is unavailable.");
    return () => {};
  }
  return registerHighlight(range);
}

"use client";

import { useCallback, useState } from "react";
import type { CanvasState } from "@/features/workspace/schema";
import type { CanvasNavigation } from "./schema";
import { canvasNavigationFailure } from "./targets";

export function useResolvedCanvasNavigation(
  canvas: CanvasState | undefined,
  navigation: CanvasNavigation | null | undefined,
) {
  const [runtimeFailure, setRuntimeFailure] = useState<{
    requestId: string;
    message: string;
  } | null>(null);
  const requestId = navigation?.requestId;
  const relationalFailure =
    canvas && navigation
      ? canvasNavigationFailure(canvas, navigation)
      : undefined;
  const onNavigationFailure = useCallback(
    (message: string) => {
      if (requestId) setRuntimeFailure({ requestId, message });
    },
    [requestId],
  );
  const visibleRuntimeFailure =
    runtimeFailure && runtimeFailure.requestId === requestId
      ? runtimeFailure.message
      : undefined;

  return {
    navigation: canvas && !relationalFailure ? navigation : null,
    navigationError: relationalFailure ?? visibleRuntimeFailure,
    onNavigationFailure,
  };
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SetupAction } from "@/features/setup/setup-machine";

export function useRoomDisplay(
  readySignal: number,
  dispatch: React.Dispatch<SetupAction>,
) {
  const displayWindow = useRef<Window | null>(null);

  useEffect(() => {
    if (readySignal > 0) dispatch({ type: "display_connected" });
  }, [dispatch, readySignal]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!displayWindow.current?.closed) return;
      displayWindow.current = null;
      dispatch({ type: "display_lost" });
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [dispatch]);

  return useCallback(() => {
    const popup = window.open(
      "/display",
      "chalkpilot-display",
      "popup,width=1440,height=900",
    );
    if (!popup) {
      window.alert(
        "Allow pop-ups for this site, then open the clean display again.",
      );
      return;
    }
    displayWindow.current = popup;
    popup.focus();
  }, []);
}

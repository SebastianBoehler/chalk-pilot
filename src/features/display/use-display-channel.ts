"use client";

import { useEffect, useReducer, useState } from "react";
import {
  emptyDisplayState,
  reduceDisplayState,
  type DisplayState,
} from "./display-reducer";
import { parseDisplayMessage, type DisplaySnapshot } from "./protocol";

const CHANNEL_NAME = "chalkpilot-display-v1";

export function useDisplayReceiver(): DisplayState {
  const [state, dispatch] = useReducer(reduceDisplayState, emptyDisplayState);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const message = parseDisplayMessage(event.data);
      if (message) dispatch(message);
    };
    channel.postMessage({ version: 1, type: "ready" });
    return () => channel.close();
  }, []);

  return state;
}

export function useDisplayPublisher(snapshot: DisplaySnapshot): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const message = parseDisplayMessage(event.data);
      if (message?.type === "ready") {
        setConnected(true);
        channel.postMessage({
          version: 1,
          type: "snapshot",
          payload: snapshot,
        });
      }
    };
    channel.postMessage({ version: 1, type: "snapshot", payload: snapshot });
    return () => channel.close();
  }, [snapshot]);

  return connected;
}

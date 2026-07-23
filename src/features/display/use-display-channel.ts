"use client";

import { useEffect, useReducer, useRef, useState } from "react";
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

export function useDisplayPublisher(snapshot: DisplaySnapshot) {
  const [connected, setConnected] = useState(false);
  const [readySignal, setReadySignal] = useState(0);
  const channelRef = useRef<BroadcastChannel>(null);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      const message = parseDisplayMessage(event.data);
      if (message?.type === "ready") {
        setConnected(true);
        setReadySignal((value) => value + 1);
        channel.postMessage({
          version: 1,
          type: "snapshot",
          payload: snapshotRef.current,
        });
      }
    };
    return () => {
      channelRef.current = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    snapshotRef.current = snapshot;
    channelRef.current?.postMessage({
      version: 1,
      type: "snapshot",
      payload: snapshot,
    });
  }, [snapshot]);

  return { connected, readySignal };
}

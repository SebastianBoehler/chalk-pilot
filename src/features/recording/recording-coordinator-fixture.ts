import { vi } from "vitest";
import { RecordingCoordinator } from "./recording-coordinator";
import {
  FakeRecorder,
  FakeRecordingClient,
  FakeTrack,
  stream,
} from "./recording-test-helpers";

export function coordinatorFixture(maxPendingUploads = 10) {
  const boardTrack = new FakeTrack("video");
  const speakerTrack = new FakeTrack("video");
  const microphoneTrack = new FakeTrack("audio");
  const displayVideoTrack = new FakeTrack("video");
  const displayAudioTrack = new FakeTrack("audio");
  const board = stream(boardTrack);
  const speaker = stream(speakerTrack);
  const microphone = stream(microphoneTrack);
  const display = stream(displayVideoTrack, displayAudioTrack);
  const recorders: FakeRecorder[] = [];
  const client = new FakeRecordingClient();
  let clock = 100;
  const getDisplayMedia = vi.fn(async () => display);
  const coordinator = new RecordingCoordinator({
    client,
    createMediaStream: (tracks) =>
      stream(...(tracks as unknown as FakeTrack[])),
    createRecorder: (source) => {
      const recorder = new FakeRecorder(source);
      recorders.push(recorder);
      return recorder;
    },
    getDisplayMedia,
    maxPendingUploads,
    now: () => clock,
  });
  return {
    board,
    boardTrack,
    client,
    coordinator,
    display,
    displayAudioTrack,
    displayVideoTrack,
    getDisplayMedia,
    microphone,
    microphoneTrack,
    recorders,
    setClock: (value: number) => {
      clock = value;
    },
    speaker,
    speakerTrack,
  };
}

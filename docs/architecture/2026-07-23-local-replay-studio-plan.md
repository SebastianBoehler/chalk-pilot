# Local Replay Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox syntax for tracking.

**Goal:** Persist five synchronized lecture tracks locally and provide a
browser Replay Studio with view switching, transcript seeking, and export.

**Architecture:** A client recording coordinator validates all capture sources,
starts one monotonic clock, and uploads numbered MediaRecorder chunks. A
filesystem recording repository finalizes versioned manifests and streams
tracks to a leader/follower replay controller.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Zod 4, MediaRecorder,
OpenAI Realtime WebRTC, MediaPipe Tasks Vision, Vitest, and Playwright.

## Global Constraints

- Store recordings only under `.chalkpilot/sessions/<id>/recordings/`.
- Keep board, speaker, canvas, microphone, and desktop audio separate.
- Never silently continue when a required start track is absent.
- Keep recording state above the collapsible controls.
- Use the selected microphone for recording and OpenAI Realtime.
- Process presenter detection locally; do not upload room frames.
- Keep new source files below 300 lines and avoid model-authored code.

---

### Task 1: Recording contracts and local repository

**Files:**

- Create recording schema, repository, and repository tests under
  `src/features/recording/`.
- Modify: `src/features/workspace/paths.ts`

**Interfaces:**

```ts
type TrackKind =
  | "board"
  | "speaker"
  | "canvas"
  | "microphone"
  | "desktop-audio";
createRecordingRepository(root): {
  create(sessionId): Promise<RecordingManifest>;
  appendChunk(sessionId, track, sequence, metadata, bytes): Promise<void>;
  appendTimeline(sessionId, event: RecordingTimelineEvent): Promise<void>;
  interrupt(sessionId, track, message): Promise<RecordingManifest>;
  finalize(sessionId, durationMs): Promise<RecordingManifest>;
  read(sessionId): Promise<RecordingManifest>;
  list(): Promise<RecordingSummary[]>;
}
```

- [ ] Write node-environment tests using `mkdtemp` for create, ordered upload,
      idempotent repeated upload, conflicting sequence rejection, missing
      sequence interruption, finalization, recovery, and traversal rejection.
- [ ] Run `npm test -- src/features/recording/repository.test.ts`; expect a
      missing-module failure.
- [ ] Implement strict Zod schemas with schema version `1`, five fixed track
      names, states `recording|complete|interrupted`, and health
      `healthy|complete|interrupted`.
- [ ] Add recording paths through `containedPath`; accept no client filesystem
      path.
- [ ] Serialize repository mutations per session, atomically write
      `manifest.json`, durably write chunk bytes, and combine only contiguous
      acknowledged chunks into `tracks/<kind>.webm`.
- [ ] Run the focused tests and `npm run typecheck`; expect PASS.
- [ ] Commit `feat(recording): add durable session repository`.

### Task 2: Recording APIs, streaming, and export

**Files:**

- Create API, API tests, and default repository under
  `src/features/recording/`.
- Create routes under `src/app/api/recordings/` and
  `src/app/api/sessions/[sessionId]/recording/` for the collection, manifest,
  finalize, chunks, timeline events, tracks, and export.
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

```ts
POST recording/timeline -> RecordingManifest | RecordingTimelineEvent
PUT chunk headers:
  x-chalkpilot-offset-ms, x-chalkpilot-duration-ms, content-type
POST finalize body: { durationMs: number }
GET track -> streamed WebM or 404
GET export -> streamed application/zip
```

- [ ] Write injected API tests for unknown sessions, malformed headers,
      unsupported MIME types, oversized chunks, idempotent retries, mutation
      after finalization, track range responses, and ZIP entry names.
- [ ] Run the focused test; expect missing API exports.
- [ ] Install `archiver` plus its TypeScript declarations.
- [ ] Implement route-independent handlers with explicit `400`, `404`, `409`,
      `413`, and `500` mappings; cap each chunk at 16 MiB.
- [ ] Add thin Node.js route adapters and stream files instead of loading
      finalized videos into memory.
- [ ] Stream a `.chalkpilot.zip` containing `manifest.json`, available tracks,
      `transcript.json`, and `canvas-events.json`.
- [ ] Commit `feat(recording): expose local recording APIs`.

### Task 3: Five-track capture coordinator

**Files:**

- Replace the session recorder and tests under `src/features/recording/`.
- Create client, coordinator, and coordinator tests in the same feature.
- Modify: `src/features/recording/use-session-recording.ts`

**Interfaces:**

```ts
coordinator.start({
  sessionId, board, speaker, microphone,
}): Promise<RecordingManifest>;
coordinator.stop(): Promise<RecordingManifest>;
coordinator.status:
  "idle" | "starting" | "recording" | "stopping" | "complete" | "error";
```

- [ ] Write failing tests proving display capture requests
      `audio:true`, `selfBrowserSurface:"include"`, and
      `systemAudio:"include"`, then rejects missing display video, desktop
      audio, microphone audio, board video, or speaker video before starting.
- [ ] Add tests for one shared `performance.now()` epoch, ordered two-second
      chunks, acknowledgement before release, bounded pending uploads, track
      interruption, stop waiting for uploads, and display-track cleanup.
- [ ] Run focused tests; expect failures against the existing memory recorder.
- [ ] Build video-only canvas and audio-only desktop streams from the one
      protected `getDisplayMedia` result; never stop caller-owned room or
      microphone tracks.
- [ ] Upload every non-empty recorder event immediately with sequence and
      relative timing metadata; remove browser blob-download accumulation.
- [ ] Finalize on explicit stop and expose the replay URL from the returned
      manifest.
- [ ] Commit `feat(recording): capture five synchronized tracks`.

### Task 4: Microphone setup and Realtime reuse

**Files:**

- Create microphone service and tests under `src/features/audio/`.
- Create microphone setup step and tests under `src/components/setup/`.
- Modify setup machine, flow, ready step, and their tests under
  `src/features/setup/` and `src/components/setup/`.
- Modify Realtime session, client-secret, their tests, and `README.md`.

**Interfaces:**

```ts
requestMicrophone(mediaDevices, deviceId?): Promise<MediaStream>;
new ChalkPilotRealtime({ microphone: MediaStream, ...existingOptions });
new OpenAIRealtimeWebRTC({ mediaStream: microphone });
```

- [ ] Write failing device-list, permission-error, selected-device, live-track,
      and level-normalization tests.
- [ ] Add a setup-machine `microphone` step between camera and calibration and
      require its confirmed state in `setupReady`.
- [ ] Render device selection, a live `<meter>`, and a confirm button; stop a
      superseded stream but retain the confirmed stream through the session.
- [ ] Write a Realtime test asserting the session factory receives the exact
      confirmed stream.
- [ ] Construct `OpenAIRealtimeWebRTC({ mediaStream })`, pass it as the
      `RealtimeSession` transport, and use `gpt-realtime-mini` consistently in
      both the session and ephemeral client-secret request.
- [ ] Commit `feat(setup): share selected microphone with realtime`.

### Task 5: Dynamic calibration and presenter tracking

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Replace speaker tracker and tests under `src/features/recording/`.
- Create pose worker and client in the same feature.
- Modify: `src/features/recording/derived-video-streams.ts`
- Modify: `src/components/setup/output-preview-step.tsx`
- Modify: `src/components/setup/setup-flow.tsx`
- Modify: `src/components/setup/calibration-step.test.tsx`

**Interfaces:**

```ts
interface PersonBox { id: string; x: number; y: number; width: number; height: number }
selectPresenter(boxes, point): PersonBox;
updatePresenter(previous, boxes): PresenterState;
createDerivedVideoStreams(video, { presenter }): DerivedVideoStreams;
```

- [ ] Write geometry tests for selection, nearest-continuous association,
      smoothing, temporary loss, bounded crop, and refusal to jump to a distant
      detection.
- [ ] Install `@mediapipe/tasks-vision`; configure Pose Landmarker in `VIDEO`
      mode with monotonically increasing timestamps and pose-derived boxes.
- [ ] Run detection on downscaled worker `ImageBitmap` frames at no more than 8
      FPS, surface errors, and replace motion tracking while holding the last
      valid crop during reported loss.
- [ ] Add click-to-confirm presenter plus tracking status to output preview;
      prevent continuation until one presenter is confirmed.
- [ ] Listen for camera `loadedmetadata`/resize changes, invalidate stale board
      calibration, and redetect against current `videoWidth`/`videoHeight`.
- [ ] Run focused geometry/setup tests and `npm run typecheck`; expect PASS.
- [ ] Commit `feat(tracking): add confirmed presenter tracking`.

### Task 6: Session-owned recording and timed evidence

**Files:**

- Modify controller, workspace, recording controls, and tests under
  `src/components/session/`.
- Modify transcript and tests under `src/features/session/`.
- Modify Realtime session and tests under `src/features/realtime/`.

**Interfaces:**

```ts
recording.noteCueStart("user" | "assistant", atMs);
recording.noteCueEnd("user" | "assistant", atMs);
recording.attachTranscript(line);
recording.noteCanvas(canvas, atMs);
```

- [ ] Write tests for speech/audio cue bounds, delayed transcript attachment,
      canvas revision timestamps, and recording state surviving controls
      unmount/remount.
- [ ] Move `useSessionRecording` into `SessionController`, make controls
      presentational, and feed Realtime speech/audio bounds plus completed text
      into the coordinator.
- [ ] Record every changed canvas revision with its relative offset.
- [ ] Replace old download links with persistent status, duration, stop, and
      `Open replay` controls.
- [ ] Run focused component, transcript, and Realtime tests; expect PASS.
- [ ] Commit `feat(session): persist synchronized recording evidence`.

### Task 7: Replay library and synchronized player

**Files:**

- Create: `src/features/replay/synchronizer.ts`
- Create: `src/features/replay/synchronizer.test.ts`
- Create: `src/features/replay/client.ts`
- Create library, player, and transcript components under
  `src/components/replay/`.
- Create: `src/app/replay/page.tsx`
- Create: `src/app/replay/[sessionId]/page.tsx`

**Interfaces:**

```ts
createReplaySynchronizer(leader, followers, {
  softDriftMs: 120,
  hardDriftMs: 500,
});
```

- [ ] Write synchronizer tests for shared play/pause, seek, soft playback-rate
      correction, hard seek, source switching, and cleanup.
- [ ] Implement `/replay` cards for start time, duration, state, and available
      tracks with empty/error states.
- [ ] Implement the primary board/speaker/canvas viewport, optional
      picture-in-picture, uninterrupted switching, and separate microphone and
      desktop-audio controls led by one selected timeline element.
- [ ] Highlight active transcript cues and seek the leader on click.
- [ ] Add individual track and portable-package download actions.
- [ ] Commit `feat(replay): add synchronized local studio`.

### Task 8: End-to-end verification and handoff

**Files:**

- Modify: `e2e/setup.spec.ts`
- Create: `e2e/replay.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `README.md`
- Modify: `.gitignore`

- [ ] Replace the three-video E2E with mocked five-track capture and assert
      recording survives sidebar collapse, finalizes, and opens Replay Studio.
- [ ] Add E2E assertions for switching board/speaker/canvas without time reset,
      transcript seek, audio controls, individual download, and package export.
- [ ] Add `.chalkpilot/sessions/` recording behavior and the mandatory Chrome
      desktop-audio selection instructions to README; keep `.chalkpilot`
      ignored.
- [ ] Run `npm run format`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:e2e`, and `npm run build`; expect all PASS.
- [ ] Start production locally, complete a real Chrome microphone and
      display-audio capture, record several seconds, stop, replay all available
      tracks, switch views, seek transcript, and download the package.
- [ ] Confirm no credentials, generated recordings, model output, or source
      file over 300 lines enters the diff.
- [ ] Commit `test: verify local replay studio end to end`.

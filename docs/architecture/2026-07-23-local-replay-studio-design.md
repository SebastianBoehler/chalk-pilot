# Local Replay Studio

**Status:** Approved design, pending written review  
**Date:** 2026-07-23

## Purpose

ChalkPilot should leave a lecture-hall or home learning session with a durable,
reviewable record. The recording must preserve the corrected board, speaker or
fixed camera view, learning canvas, microphone, desktop audio, conversation
transcript, and canvas changes on one synchronized timeline.

This release is a local Replay Studio. It does not add accounts, cloud storage,
sharing, remote transcoding, or course-level publishing. Those can later use the
same session manifest and storage interface.

## Chosen Approach

The browser captures the room inputs and continuously uploads bounded recording
chunks to the local Next.js application. The server stores them below:

```text
.chalkpilot/sessions/<session-id>/recordings/
```

This approach keeps the current web architecture and avoids retaining an
entire lecture in browser memory. It also makes an interrupted recording
recoverable and establishes a clean boundary for a future cloud-backed
recording store.

Two alternatives are rejected for this release:

- The current in-memory recorder is too fragile for long sessions and loses
  unexported data on refresh or failure.
- A native or FFmpeg companion adds installation and platform complexity before
  browser capture has been tested in the room.

## Setup Flow

### Camera

The learner selects any camera exposed by the browser, including a room camera
or macOS Continuity Camera. Setup then chooses one of two uses:

- `room-wide` derives the board and tracked presenter locally from one
  high-resolution wide stream;
- `board-focused` supports a nearby fixed camera pointed at a whiteboard or
  flip chart and uses its full frame as the speaker/video output.

The implementation does not special-case camera names or require an
iPhone-specific API.

Board calibration uses the live stream's actual `videoWidth` and `videoHeight`.
The calibration surface and coordinate conversion update after loaded metadata
and whenever the stream dimensions change. No fixed aspect ratio is assumed.

### Microphone

Setup lists available microphones and includes a live level test. The confirmed
microphone stream is reused by:

- the OpenAI Realtime WebRTC transport; and
- the dedicated microphone recording track.

This avoids testing one input while the learning partner uses another.

### Presenter

In `room-wide` mode, motion-centroid tracking is replaced by MediaPipe Tasks
Vision Pose Landmarker, running in a web worker against downscaled frames.
Setup shows pose-derived person boxes on the wide view and lets the user confirm
the presenter. `board-focused` mode skips presenter confirmation because the
fixed full camera view is already the intended output.

During the session, detections are associated with the confirmed presenter by
proximity to the preceding box and temporal continuity. The crop is smoothed to
avoid jitter. If the presenter is temporarily lost, the crop holds its last
valid position and reports tracking loss; it does not jump to moving monitor
content or another person. Reacquisition must satisfy the same continuity
rules.

The detector runs locally at a bounded low frame rate. Camera frames are not
uploaded for tracking.

## Recording Architecture

### Coordinator

One `RecordingCoordinator` owns the full lifecycle above the collapsible
session-controls subtree. Collapsing, hiding, or rerendering controls cannot
unmount the active recorder.

Recording begins and ends only through explicit user actions. Starting is
transactional: no recorder starts until all requested source tracks are live.

### Tracks

Five independent tracks share one monotonic recording clock:

1. `board`: perspective-corrected board video.
2. `speaker`: locally tracked presenter crop in `room-wide` mode or the fixed
   full camera frame in `board-focused` mode.
3. `canvas`: the clean ChalkPilot display selected through browser display
   capture.
4. `microphone`: the confirmed room or laptop microphone.
5. `desktop-audio`: audio returned with the selected display surface.

Microphone and desktop audio remain separate. Replay mixes them with independent
mute and volume controls. A later export process may produce a mixed listening
track without destroying the sources.

Chrome's protected display picker appears for every recording start. ChalkPilot
requests the current browser surface and system audio, but the browser retains
final control. After selection, ChalkPilot verifies both canvas video and
desktop audio. If either is missing, start fails with instructions to select
the clean ChalkPilot tab or display and enable audio.

### Clock and chunks

The coordinator records a wall-clock start time for display and a monotonic
start time for synchronization. Every track receives the same recording epoch.

`MediaRecorder` emits short, numbered chunks. Each upload includes:

- session ID;
- track kind;
- monotonically increasing sequence number;
- offset from the recording epoch;
- observed duration;
- MIME type; and
- chunk bytes.

The server acknowledges durable storage before the client releases its
reference. A small bounded upload queue absorbs ordinary filesystem latency.
If the queue cannot drain, the affected track reports an error rather than
allowing unbounded memory growth.

## Local Storage

A recording-store interface isolates the API and Replay Studio from the
filesystem implementation. The local implementation owns only the recording
subdirectory for the selected session.

The directory contains:

```text
recordings/
  manifest.json
  tracks/
    board.webm
    speaker.webm
    canvas.webm
    microphone.webm
    desktop-audio.webm
  chunks/
  transcript.json
  canvas-events.json
```

Chunk files use validated track names and numeric sequence names. Client paths
are never accepted. Finalization combines ordered chunks, persists duration and
health, and removes only chunks confirmed in the finalized track.

An interrupted session keeps its chunks and is listed as `interrupted`.
Recovery finalizes all contiguous acknowledged chunks. Missing sequence numbers
are recorded in the manifest and never concealed.

## Session Manifest

The versioned manifest is the portable contract for local replay and future
cloud storage. It contains:

- schema version and session ID;
- wall-clock start and monotonic duration;
- recording state: `recording`, `complete`, or `interrupted`;
- each track's MIME type, duration, byte size, health, and relative path;
- missing or interrupted track details;
- transcript and canvas-event paths; and
- creation and finalization timestamps.

Track health is `healthy`, `interrupted`, or `complete`. Filesystem paths remain
server-internal and are exposed to the client only through validated recording
routes.

## Transcript and Canvas Events

User transcript cues use Realtime speech-start and speech-stop events as their
time bounds. Pilot cues use audio-start and audio-stop. Final text is attached
when transcription or response history completes.

Each cue stores speaker, start offset, end offset, and text. If final text
arrives after the recording stops, the cue may still be completed while the
session is being finalized.

Every persisted canvas revision also records its recording-relative offset.
Replay can therefore restore the canvas state at any point instead of relying
only on captured pixels. The canvas video remains available as the exact room
display record.

## Replay Studio

`/replay` lists local recorded sessions with start time, duration, completion
state, and available tracks.

`/replay/<session-id>` provides:

- one shared play/pause control and timeline;
- a primary view switcher for board, speaker, and canvas;
- uninterrupted playback position when switching views;
- an optional second picture-in-picture view;
- synchronized microphone and desktop-audio controls;
- a transcript that highlights the active cue;
- click-to-seek transcript entries;
- visible missing or interrupted track state;
- individual track downloads; and
- one portable ChalkPilot session-package export.

One media element is the timeline leader. Other active media elements follow
its time and playback state. Small drift is corrected gradually; material drift
causes an explicit seek to the leader time. View switching reuses the shared
time rather than starting a new playback session.

The portable package contains the manifest, finalized tracks, transcript, and
canvas events. Import and cloud upload are deferred; the package format is
deliberately suitable for both.

## API Boundary

Recording routes create a recording for an existing session, upload one
validated track chunk, report interruption, finalize, list local recordings,
read a manifest, and stream finalized tracks or a portable export.

Mutating routes reject unknown sessions, unknown track kinds, duplicate
conflicting sequences, unsupported MIME types, oversized chunks, and mutations
after finalization. Repeating an identical acknowledged chunk or finalize
request is idempotent.

## Failure Handling

- Cancelling microphone or display permission returns the coordinator to idle.
- A missing source at start prevents all recorders from starting.
- Track loss during recording marks that track interrupted while healthy tracks
  continue and remain recoverable.
- Every uploaded chunk is acknowledged before browser memory is released.
- Refresh, tab failure, or application restart leaves an interrupted session
  discoverable from its durable manifest and chunks.
- Stop waits for active uploads, finalizes recoverable tracks, then navigates or
  links to Replay Studio.
- Filesystem, quota, recorder, and source errors remain visible and cannot
  produce a false `complete` state.
- Existing recording data is never deleted as part of error recovery.

## Verification

Unit coverage must include:

- shared clock and chunk metadata;
- ordered, repeated, conflicting, and missing chunk sequences;
- manifest transitions and validation;
- microphone and display-track validation;
- presenter selection, continuity, loss, and reacquisition;
- transcript cue timing;
- replay leader/follower synchronization; and
- recording state persistence across controls rerenders.

Integration coverage must include:

- recording creation;
- chunk persistence;
- interruption and recovery;
- finalization;
- manifest and track reads;
- recording listing; and
- portable export contents.

Browser end-to-end coverage covers setup and microphone selection, dynamic
board calibration, presenter confirmation, recording across sidebar collapse,
finalization, opening Replay Studio, synchronized view switching, transcript
seeking, and downloads.

A real local Chrome pass must verify microphone capture and the protected
display-selection flow. The browser picker itself cannot be bypassed or fully
automated. The test therefore verifies that ChalkPilot rejects a selected
surface without an audio track and accepts one that returns both canvas video
and desktop audio.

Before handoff, formatting, lint, type checking, unit/integration tests,
Playwright tests, and the production build must pass.

## Explicitly Deferred

This release does not add cloud storage, accounts, permissions, sharing,
server-side transcoding, adaptive streaming, a native capture helper, automatic
recording, capture without consent, transcript editing, collaborative
annotations, public publishing, arbitrary layout editing, or sandboxed canvas
applications.
